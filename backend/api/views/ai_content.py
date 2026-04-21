import os
import logging
import requests as http_requests

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.conf import settings
from django.utils import timezone

from ..models import BrandProfile
from ..ai_service import (
    generate_all_content, polish_content, generate_image_flux,
    check_ollama_status, generate_caption, generate_caption_ollama,
)

logger = logging.getLogger(__name__)

VALID_PLATFORMS = {'instagram', 'linkedin', 'twitter'}
VALID_TONES = {'professional', 'casual', 'funny', 'inspirational'}
VALID_PROVIDERS = {'groq', 'ollama', 'gemini'}
VALID_IMAGE_PROVIDERS = {'unsplash', 'flux'}


def _resolve_provider(value):
    value = (value or 'groq').lower()
    return value if value in VALID_PROVIDERS else 'groq'


def _brand_context_for(user):
    try:
        return user.brand_profile.to_context_string()
    except BrandProfile.DoesNotExist:
        return None


def _unsplash_keywords(image_prompt):
    """Extract 3-5 concrete visual keywords from an image prompt for Unsplash search."""
    try:
        from groq import Groq
        import os as _os
        groq_client = Groq(api_key=_os.getenv('GROQ_API_KEY'))
        resp = groq_client.chat.completions.create(
            model='meta-llama/llama-4-scout-17b-16e-instruct',
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
        # Fallback if response is too long or looks wrong
        if len(keywords) <= 80:
            return keywords
    except Exception:
        pass
    # Fallback: take first 80 chars up to a word boundary
    truncated = image_prompt[:80]
    return truncated[:truncated.rfind(' ')] if ' ' in truncated else truncated


def _resolve_brand_context(request):
    """Use client's brand profile when a specialist generates for a specific client.
    Owners always use their own brand profile. Specialists have no personal brand profile."""
    from ..models import User
    if request.user.role == 'specialist':
        client_id = request.data.get('client_id')
        if client_id:
            try:
                client = User.objects.get(id=client_id, specialist=request.user, role='client')
                return _brand_context_for(client)
            except User.DoesNotExist:
                pass
        return None
    return _brand_context_for(request.user)


def _save_generated_image(content_bytes, user_id):
    """Persist AI-generated image bytes to MEDIA_ROOT and return a public URL."""
    from pathlib import Path
    import uuid

    posts_dir = Path(settings.MEDIA_ROOT) / 'posts'
    posts_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{user_id}-{uuid.uuid4().hex}.jpg"
    (posts_dir / filename).write_bytes(content_bytes)
    return f"{settings.BACKEND_PUBLIC_URL}{settings.MEDIA_URL}posts/{filename}"


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_status(request):
    return Response(check_ollama_status())


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_content(request):
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
        last_error = None
        for attempt in range(2):
            current_seed = seed if (attempt == 0 and seed is not None) else random.randint(1, 10_000_000)
            url = generate_image_flux(prompt, platform, seed=current_seed)
            try:
                img_resp = http_requests.get(url, timeout=60)
                if img_resp.status_code == 200 and len(img_resp.content) >= 1000:
                    public_url = _save_generated_image(img_resp.content, request.user.id)
                    return Response({'image_url': public_url})
                logger.warning('Flux attempt %d: status=%s size=%s seed=%s',
                               attempt + 1, img_resp.status_code, len(img_resp.content), current_seed)
                last_error = f'status {img_resp.status_code}, size {len(img_resp.content)}'
            except http_requests.Timeout:
                logger.warning('Flux attempt %d timed out (seed=%s)', attempt + 1, current_seed)
                last_error = 'timeout'
            except Exception as e:
                logger.error('Flux attempt %d failed: %s', attempt + 1, e, exc_info=True)
                last_error = str(e)

        logger.error('Flux failed after 3 attempts: %s', last_error)
        return Response(
            {'error': 'Flux image service is currently unavailable. Try again in a moment or switch to Unsplash.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    access_key = os.getenv('UNSPLASH_ACCESS_KEY')
    if not access_key:
        return Response({'error': 'Image service is not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    orientation = 'squarish' if platform == 'instagram' else 'landscape'

    # Extract the 3-5 most visually concrete keywords from the image prompt
    # so Unsplash (keyword-based search) returns a matching photo
    query = _unsplash_keywords(prompt)

    url = f"https://api.unsplash.com/photos/random?query={http_requests.utils.quote(query)}&orientation={orientation}"
    headers = {'Authorization': f'Client-ID {access_key}'}

    try:
        resp = http_requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return Response({'image_url': data['urls']['regular']})
        return Response({'error': 'No image found'}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        logger.error('Unsplash image fetch failed: %s', e, exc_info=True)
        return Response({'error': 'Image service unavailable. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_variants(request):
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
    variant_instructions = [
        topic,
        f"{topic} (Make it shorter and punchier)",
        f"{topic} (Make it more storytelling and emotional)",
    ]

    variants = []
    try:
        for instr in variant_instructions:
            if provider == 'ollama':
                cap = generate_caption_ollama(instr, platform, tone, brand_ctx)
            else:
                cap = generate_caption(instr, platform, tone, brand_ctx)
            variants.append(cap)
    except Exception as e:
        logger.error('Variant generation failed: %s', e, exc_info=True)
        return Response(
            {'error': 'Variant generation failed. Please try again later.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response({'variants': variants})