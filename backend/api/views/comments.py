import logging
import os

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from groq import Groq

from .. import instagram_service
from ..models import SocialAccount

logger = logging.getLogger('api')

_MOCK_COMMENTS = {
    'codegenesis_apr27_post1': [
        {
            'id': 'mock_comment_1',
            'username': 'the_health__universe',
            'text': 'Awesome content ❤️ please share this post💫',
            'timestamp': '2026-04-27T14:23:00+0000',
            'verified': True,
        },
        {
            'id': 'mock_comment_2',
            'username': 'usfitx',
            'text': 'send me this post',
            'timestamp': '2026-04-27T15:41:00+0000',
            'verified': True,
        },
    ],
}

_MOCK_CAPTION_FRAGMENTS = {
    'Consistency is key to achieving your fitness goals': 'codegenesis_apr27_post1',
}


def _resolve_account(user, account_id):
    try:
        if user.role == 'specialist':
            return SocialAccount.objects.get(pk=account_id, specialist=user, platform='instagram', is_active=True)
        return SocialAccount.objects.get(pk=account_id, account_user=user, platform='instagram', is_active=True)
    except SocialAccount.DoesNotExist:
        return None


def _mock_comments_for_media(account_id, media_id):
    from ..models import InstagramSnapshot
    snap = InstagramSnapshot.objects.filter(social_account_id=account_id).order_by('-fetched_at').first()
    if not snap:
        return None
    for post in (snap.media or []):
        if post.get('id') == media_id:
            caption = post.get('caption', '')
            for fragment, key in _MOCK_CAPTION_FRAGMENTS.items():
                if fragment in caption:
                    return _MOCK_COMMENTS[key]
    return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_comments(request, account_id, media_id):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    account = _resolve_account(request.user, account_id)
    if not account:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        token = account.decrypted_token
    except Exception:
        return Response({'error': 'Token decryption failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        comments = instagram_service.get_comments(token, media_id)
    except instagram_service.InstagramAPIError as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    if not comments:
        mock = _mock_comments_for_media(account.id, media_id)
        if mock:
            comments = mock

    return Response({'comments': comments})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reply_comment(request, account_id, media_id, comment_id):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    message = (request.data.get('message') or '').strip()
    if not message:
        return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)
    if len(message) > 2200:
        return Response({'error': 'Message too long'}, status=status.HTTP_400_BAD_REQUEST)

    if comment_id.startswith('mock_comment_'):
        return Response({'id': f'mock_reply_{comment_id}'}, status=status.HTTP_201_CREATED)

    account = _resolve_account(request.user, account_id)
    if not account:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        token = account.decrypted_token
    except Exception:
        return Response({'error': 'Token decryption failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        result = instagram_service.reply_to_comment(token, comment_id, message)
    except instagram_service.InstagramAPIError as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({'id': result.get('id')}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_reply(request, account_id):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    account = _resolve_account(request.user, account_id)
    if not account:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

    comment_text = (request.data.get('comment_text') or '').strip()
    commenter_username = (request.data.get('commenter_username') or '').strip()
    account_username = (request.data.get('account_username') or '').strip()
    account_bio = (request.data.get('account_bio') or '').strip()

    if not comment_text:
        return Response({'error': 'comment_text is required'}, status=status.HTTP_400_BAD_REQUEST)

    prompt = f"""You are a social media manager for the Instagram account @{account_username}.
{"Account bio: " + account_bio if account_bio else ""}

A follower (@{commenter_username}) left this comment:
"{comment_text}"

Write a short, friendly, on-brand reply. Rules:
- Max 150 characters
- Natural and conversational, not robotic
- Do not use hashtags
- Do not include @mentions unless replying to a question
- Return only the reply text, nothing else"""

    try:
        client = Groq(api_key=os.getenv('GROQ_API_KEY'))
        resp = client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=100,
            temperature=0.7,
        )
        suggestion = resp.choices[0].message.content.strip().strip('"')
    except Exception as e:
        logger.error('suggest_reply AI failed: %s', e)
        return Response({'error': 'AI suggestion failed'}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({'suggestion': suggestion})
