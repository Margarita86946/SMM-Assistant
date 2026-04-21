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

    brand_ctx = _brand_context_for(request.user)
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

    try:
        result = polish_content(caption, hashtags, platform, tone, image_prompt, topic, provider=provider)
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
    if len(prompt) > 500:
        return Response({'error': 'Prompt must be 500 characters or fewer'}, status=status.HTTP_400_BAD_REQUEST)

    if image_provider == 'flux':
        seed = request.data.get('seed')
        try:
            seed = int(seed) if seed is not None else None
        except (TypeError, ValueError):
            seed = None
        url = generate_image_flux(prompt, platform, seed=seed)
        try:
            img_resp = http_requests.get(url, timeout=180)
            if img_resp.status_code != 200 or len(img_resp.content) < 1000:
                logger.error('Flux returned status=%s size=%s', img_resp.status_code, len(img_resp.content))
                return Response({'error': 'Flux image service returned empty response. Try again.'}, status=status.HTTP_502_BAD_GATEWAY)
            public_url = _save_generated_image(img_resp.content, request.user.id)
            return Response({'image_url': public_url})
        except http_requests.Timeout:
            return Response({'error': 'Flux image generation timed out. Try again.'}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except Exception as e:
            logger.error('Flux fetch failed: %s', e, exc_info=True)
            return Response({'error': 'Flux image service unavailable. Try again.'}, status=status.HTTP_502_BAD_GATEWAY)

    access_key = os.getenv('UNSPLASH_ACCESS_KEY')
    if not access_key:
        return Response({'error': 'Image service is not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    orientation = 'squarish' if platform == 'instagram' else 'landscape'
    query = prompt[:100]
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

    brand_ctx = _brand_context_for(request.user)
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