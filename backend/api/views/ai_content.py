import os
import logging
import requests as http_requests

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.conf import settings
from django.utils import timezone

from ..models import BrandProfile, SocialAccount
from ..ai_service import (
    generate_all_content, polish_content, generate_image_flux,
    check_ollama_status, generate_caption, generate_caption_ollama,
)

logger = logging.getLogger(__name__)

VALID_PLATFORMS = {'instagram', 'linkedin', 'twitter'}
VALID_TONES = {'professional', 'casual', 'funny', 'inspirational'}
VALID_PROVIDERS = {'groq', 'ollama'}
VALID_IMAGE_PROVIDERS = {'unsplash', 'flux'}

_CLIENT_FORBIDDEN = Response(
    {'error': 'AI generation is not available for client accounts.'},
    status=status.HTTP_403_FORBIDDEN,
)


def _resolve_provider(value):
    value = (value or 'groq').lower()
    return value if value in VALID_PROVIDERS else 'groq'


def _brand_context_for_account(account_id, owner_user):
    try:
        account = SocialAccount.objects.get(pk=account_id, account_user=owner_user)
        return account.brand_profile.to_context_string()
    except (SocialAccount.DoesNotExist, BrandProfile.DoesNotExist):
        return None


def _unsplash_keywords(image_prompt):
    try:
        from groq import Groq
        import os as _os
        groq_client = Groq(api_key=_os.getenv('GROQ_API_KEY'))
        resp = groq_client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            timeout=10,
            messages=[{
                'role': 'user',
                'content': (
                    f'Extract 3 to 5 concrete visual nouns or short phrases from this image description '
                    f'that would work best as a photo search query. '
                    f'Return ONLY the keywords separated by spaces, nothing else.\n\n{image_prompt}'
                ),
            }],
        )
        keywords = resp.choices[0].message.content.strip()
        if len(keywords) <= 80:
            return keywords
    except Exception:
        pass
    truncated = image_prompt[:80]
    return truncated[:truncated.rfind(' ')] if ' ' in truncated else truncated


def _resolve_brand_context(request):
    account_id = request.data.get('account_id')
    if account_id:
        if request.user.role == 'specialist':
            try:
                account = SocialAccount.objects.get(pk=account_id, specialist=request.user)
                return account.brand_profile.to_context_string()
            except (SocialAccount.DoesNotExist, BrandProfile.DoesNotExist):
                return None
        return _brand_context_for_account(account_id, request.user)

    if request.user.role == 'specialist':
        from ..models import User
        client_id = request.data.get('client_id')
        if client_id:
            try:
                account = SocialAccount.objects.filter(
                    account_user_id=client_id, specialist=request.user,
                ).select_related('brand_profile').first()
                if account:
                    return account.brand_profile.to_context_string()
            except BrandProfile.DoesNotExist:
                pass
        return None

    return None


def _save_generated_image(content_bytes, user_id):
    import os as _os
    cloud_name = _os.getenv('CLOUDINARY_CLOUD_NAME')
    api_key = _os.getenv('CLOUDINARY_API_KEY')
    api_secret = _os.getenv('CLOUDINARY_API_SECRET')

    if cloud_name and api_key and api_secret:
        import cloudinary
        import cloudinary.uploader
        import io
        cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret)
        result = cloudinary.uploader.upload(
            io.BytesIO(content_bytes),
            folder='smm_assistant',
            resource_type='image',
        )
        return result['secure_url']

    from pathlib import Path
    import uuid
    posts_dir = Path(settings.MEDIA_ROOT) / 'posts'
    posts_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{user_id}-{uuid.uuid4().hex}.jpg"
    (posts_dir / filename).write_bytes(content_bytes)
    media_base = _os.getenv('MEDIA_PUBLIC_URL', 'http://localhost:8000').rstrip('/')
    return f"{media_base}{settings.MEDIA_URL}posts/{filename}"


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_status(request):
    return Response(check_ollama_status())


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_content(request):
    if request.user.role == 'client':
        return _CLIENT_FORBIDDEN
    topic = request.data.get('topic', '').strip()
    platform = request.data.get('platform', 'instagram').lower()
    tone = request.data.get('tone', 'professional').lower()
    provider = _resolve_provider(request.data.get('provider'))

    if not topic:
        return Response({'error': 'Topic is required'}, status=status.HTTP_400_BAD_REQUEST)
    if len(topic) > 500:
        return Response({'error': 'Topic must be 500 characters or fewer'}, status=status.HTTP_400_BAD_REQUEST)
    if platform not in VALID_PLATFORMS:
        return Response({'error': f'Platform must be one of: {", ".join(VALID_PLATFORMS)}'}, status=status.HTTP_400_BAD_REQUEST)
    if tone not in VALID_TONES:
        return Response({'error': f'Tone must be one of: {", ".join(VALID_TONES)}'}, status=status.HTTP_400_BAD_REQUEST)

    brand_ctx = _resolve_brand_context(request)
    result = generate_all_content(topic, platform, tone, brand_profile=brand_ctx, provider=provider)

    if result.get('error'):
        return Response(
            {'error': result['error']},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    result.pop('error', None)
    return Response(result, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def polish_content_view(request):
    if request.user.role == 'client':
        return _CLIENT_FORBIDDEN
    caption = request.data.get('caption', '')
    hashtags = request.data.get('hashtags', '')
    image_prompt = request.data.get('image_prompt', '')
    topic = request.data.get('topic', '')
    platform = request.data.get('platform', 'instagram').lower()
    tone = request.data.get('tone', 'professional').lower()
    provider = _resolve_provider(request.data.get('provider'))

    if not caption.strip():
        return Response({'error': 'Caption is required'}, status=status.HTTP_400_BAD_REQUEST)
    if platform not in VALID_PLATFORMS:
        return Response({'error': f'Platform must be one of: {", ".join(VALID_PLATFORMS)}'}, status=status.HTTP_400_BAD_REQUEST)
    if tone not in VALID_TONES:
        return Response({'error': f'Tone must be one of: {", ".join(VALID_TONES)}'}, status=status.HTTP_400_BAD_REQUEST)

    brand_ctx = _resolve_brand_context(request)
    try:
        result = polish_content(caption, hashtags, platform, tone, image_prompt, topic, provider=provider, brand_profile=brand_ctx)
        return Response(result, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error('Polish content failed: %s', e, exc_info=True)
        return Response({'error': 'Content polishing failed. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_image(request):
    if request.user.role == 'client':
        return _CLIENT_FORBIDDEN
    prompt = request.data.get('prompt', '').strip()
    platform = request.data.get('platform', 'instagram').lower()
    image_provider = (request.data.get('image_provider') or 'unsplash').lower()
    if image_provider not in VALID_IMAGE_PROVIDERS:
        image_provider = 'unsplash'

    if not prompt:
        return Response({'error': 'Prompt is required'}, status=status.HTTP_400_BAD_REQUEST)

    if image_provider == 'flux':
        seed = request.data.get('seed')
        try:
            seed = int(seed) if seed is not None else None
        except (TypeError, ValueError):
            seed = None

        import random
        current_seed = seed if seed is not None else random.randint(1, 10_000_000)
        url = generate_image_flux(prompt, platform, seed=current_seed)
        try:
            img_resp = http_requests.get(url, timeout=120)
            if img_resp.status_code == 200 and len(img_resp.content) >= 1000:
                public_url = _save_generated_image(img_resp.content, request.user.id)
                return Response({'image_url': public_url})
            logger.warning('Flux returned status=%s size=%s', img_resp.status_code, len(img_resp.content))
        except http_requests.Timeout:
            logger.warning('Flux timed out after 120s')
        except Exception as e:
            logger.error('Flux failed: %s', e, exc_info=True)

        return Response(
            {'error': 'Flux image service is currently unavailable. Try again in a moment or switch to Unsplash.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    access_key = os.getenv('UNSPLASH_ACCESS_KEY')
    if not access_key:
        return Response({'error': 'Image service is not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    orientation = 'squarish' if platform == 'instagram' else 'landscape'
    headers = {'Authorization': f'Client-ID {access_key}'}

    query = _unsplash_keywords(prompt)
    url = f"https://api.unsplash.com/photos/random?query={http_requests.utils.quote(query)}&orientation={orientation}"

    try:
        resp = http_requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return Response({'image_url': data['urls']['regular']})
        logger.warning('Unsplash returned %s for query "%s"', resp.status_code, query)
        return Response({'error': 'No image found'}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        logger.error('Unsplash fetch failed: %s', e, exc_info=True)
        return Response({'error': 'Image service unavailable. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)
