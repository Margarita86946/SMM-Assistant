import logging
import secrets
from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.db import transaction
from django.db.models import Q
from django.conf import settings
from django.utils import timezone
from django.shortcuts import redirect

from .. import instagram_service
from ..models import (
    SocialAccount, OAuthState, Post, EncryptionKey, ClientInvitation
)
from ..encryption import (
    encrypt, decrypt, DecryptionError
)
from ..audit import log_action, get_client_ip

logger = logging.getLogger('api')

OAUTH_STATE_TTL_MINUTES = 10


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instagram_oauth_start(request):
    try:
        nonce = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(minutes=OAUTH_STATE_TTL_MINUTES)
        with transaction.atomic():
            OAuthState.objects.filter(
                Q(user=request.user, platform='instagram') | Q(expires_at__lt=timezone.now())
            ).delete()
            OAuthState.objects.create(
                user=request.user,
                platform='instagram',
                nonce=nonce,
                expires_at=expires_at,
            )
        url = instagram_service.get_oauth_url(state=nonce)
        return Response({'oauth_url': url})
    except instagram_service.InstagramAPIError:
        return Response(
            {'error': 'Instagram integration is not configured'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def instagram_oauth_callback(request):
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    code = request.query_params.get('code')
    state = request.query_params.get('state')
    error = request.query_params.get('error')

    def fail_redirect(flow, reason):
        if flow == 'invitation':
            return redirect(f'{frontend_url}/accept-invitation?result={reason}')
        return redirect(f'{frontend_url}/account?instagram={reason}')

    flow = 'own'

    if error or not code or not state:
        return fail_redirect(flow, 'error')

    try:
        with transaction.atomic():
            oauth_state = (
                OAuthState.objects
                .select_for_update(of=('self',))
                .select_related('user', 'invitation', 'invitation__specialist')
                .get(nonce=state, platform='instagram')
            )
            invitation = oauth_state.invitation
            owning_user = oauth_state.user
            had_invitation = oauth_state.invitation_id is not None
            is_expired = oauth_state.expires_at < timezone.now()
            oauth_state.delete()
            if is_expired:
                flow = 'invitation' if had_invitation else 'own'
                return fail_redirect(flow, 'error')
    except OAuthState.DoesNotExist:
        return fail_redirect('own', 'error')

    if invitation is not None:
        flow = 'invitation'
        if invitation.status != 'pending' or invitation.is_expired:
            return fail_redirect(flow, 'expired')
        specialist = invitation.specialist
    else:
        specialist = owning_user

    if specialist is None:
        return fail_redirect(flow, 'error')

    try:
        short = instagram_service.exchange_code_for_token(code)
        long_lived = instagram_service.get_long_lived_token(short['access_token'])
        info = instagram_service.get_instagram_user_info(long_lived['access_token'])
    except instagram_service.InstagramAPIError:
        return fail_redirect(flow, 'error')

    account_type = (info.get('account_type') or '').upper()
    if account_type and account_type not in {'BUSINESS', 'CREATOR', 'MEDIA_CREATOR'}:
        return fail_redirect(flow, 'personal')

    instagram_user_id = info['instagram_user_id'] or short.get('user_id', '')
    instagram_username = info.get('username', '')
    expires_at = timezone.now() + timedelta(seconds=long_lived.get('expires_in', 5184000))

    active_key = EncryptionKey.get_active()
    encrypted_token = encrypt(long_lived['access_token'], active_key.id)

    if flow == 'invitation':
        encrypted_email = invitation.client_email
        try:
            with transaction.atomic():
                social_account, _ = SocialAccount.objects.update_or_create(
                    user=specialist,
                    platform='instagram',
                    instagram_user_id=instagram_user_id,
                    defaults={
                        'owned_by': specialist,
                        'account_username': instagram_username,
                        'account_type': account_type,
                        'access_token': encrypted_token,
                        'encryption_key': active_key,
                        'token_expires_at': expires_at,
                        'token_last_refreshed': timezone.now(),
                        'is_active': True,
                        'is_client_account': True,
                        'client_email': encrypted_email or '',
                    },
                )
                invitation.status = 'accepted'
                invitation.accepted_at = timezone.now()
                invitation.accepted_ip = get_client_ip(request)
                invitation.social_account = social_account
                invitation.save(update_fields=[
                    'status', 'accepted_at', 'accepted_ip', 'social_account'
                ])
        except Exception:
            return fail_redirect(flow, 'error')

        decrypted_email = invitation.decrypted_client_email
        email_domain = decrypted_email.split('@', 1)[1] if '@' in decrypted_email else ''
        log_action(
            specialist,
            'invitation_accepted',
            request=request,
            target=invitation,
            metadata={
                'client_email_domain': email_domain,
                'platform': 'instagram',
                'instagram_username': instagram_username,
            },
        )
        log_action(
            specialist,
            'account_connected',
            request=request,
            target=social_account,
            metadata={
                'platform': 'instagram',
                'username': instagram_username,
                'is_client_account': True,
            },
        )
        return redirect(f'{frontend_url}/accept-invitation?result=connected')

    try:
        social_account, _ = SocialAccount.objects.update_or_create(
            user=specialist,
            platform='instagram',
            instagram_user_id=instagram_user_id,
            defaults={
                'owned_by': specialist,
                'account_username': instagram_username,
                'account_type': account_type,
                'access_token': encrypted_token,
                'encryption_key': active_key,
                'token_expires_at': expires_at,
                'token_last_refreshed': timezone.now(),
                'is_active': True,
                'is_client_account': False,
                'client_email': '',
            },
        )
    except Exception:
        return fail_redirect(flow, 'error')

    log_action(
        specialist,
        'account_connected',
        request=request,
        target=social_account,
        metadata={
            'platform': 'instagram',
            'username': instagram_username,
            'is_client_account': False,
        },
    )
    return redirect(f'{frontend_url}/account?instagram=connected')


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def instagram_disconnect(request, pk):
    try:
        account = SocialAccount.objects.get(
            pk=pk, user=request.user, platform='instagram',
        )
    except SocialAccount.DoesNotExist:
        return Response({'error': 'No Instagram account found'}, status=status.HTTP_404_NOT_FOUND)
    username_snapshot = account.account_username
    with transaction.atomic():
        account.is_active = False
        account.access_token = ''
        account.token_expires_at = None
        account.save(update_fields=['is_active', 'access_token', 'token_expires_at'])
        if not account.is_client_account:
            Post.objects.filter(user=request.user, auto_publish=True, status='scheduled').update(auto_publish=False)
    log_action(
        request.user,
        'account_disconnected',
        request=request,
        target=account,
        metadata={'platform': 'instagram', 'username': username_snapshot},
    )
    return Response({'message': 'Instagram account disconnected'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instagram_status(request):
    from django.db.models import Q as DQ
    if request.user.role == 'specialist':
        accounts = SocialAccount.objects.filter(
            DQ(user=request.user) |
            DQ(user__specialist=request.user, user__role='client'),
            platform='instagram',
            is_active=True,
        ).select_related('user').only(
            'id', 'account_username', 'account_type', 'user_id', 'token_expires_at',
            'connected_at', 'is_client_account', 'user__id', 'user__username',
        ).order_by('connected_at')
    else:
        accounts = SocialAccount.objects.filter(
            user=request.user, platform='instagram', is_active=True,
        ).only(
            'id', 'account_username', 'account_type', 'user_id', 'token_expires_at',
            'connected_at', 'is_client_account',
        ).order_by('connected_at')

    return Response({
        'accounts': [
            {
                'id': a.id,
                'username': a.account_username,
                'account_type': a.account_type,
                'is_client_account': a.user_id != request.user.id,
                'client_username': a.user.username if a.user_id != request.user.id else None,
                'expires_at': a.token_expires_at.isoformat() if a.token_expires_at else None,
            }
            for a in accounts
        ]
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def publish_post_now(request, pk):
    with transaction.atomic():
        try:
            post = Post.objects.select_related('client').select_for_update().get(pk=pk, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

        if post.status == 'posted':
            return Response(
                {'error': 'Post has already been published'},
                status=status.HTTP_409_CONFLICT,
            )
        if post.platform != 'instagram':
            return Response(
                {'error': 'Only Instagram posts can be published right now'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        is_video = post.media_type == 'video'
        media_url = post.video_url if is_video else post.image_url

        if not media_url:
            return Response({'error': 'Post has no media to publish'}, status=status.HTTP_400_BAD_REQUEST)
        if media_url.startswith('data:'):
            return Response(
                {'error': 'Embedded media data is not reachable by Instagram. Re-upload the file and try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if media_url.startswith(('http://localhost', 'http://127.0.0.1', 'https://localhost', 'https://127.0.0.1')):
            return Response(
                {'error': (
                    'Media URL points to localhost, which Instagram cannot reach. '
                    'Set BACKEND_PUBLIC_URL in backend/.env to a public HTTPS URL '
                    '(e.g. an ngrok tunnel), restart the server, re-upload the file, and try again.'
                )},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not media_url.startswith(('http://', 'https://')):
            return Response(
                {'error': 'Media URL must be a public http(s) URL reachable by Instagram.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ig_owner = post.client if post.client_id else request.user
        try:
            account = SocialAccount.objects.get(
                user=ig_owner, platform='instagram', is_active=True,
            )
        except SocialAccount.DoesNotExist:
            if ig_owner != request.user:
                return Response(
                    {'error': 'No active Instagram account connected for this client'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {'error': 'No active Instagram account connected'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not account.access_token or (
            account.token_expires_at and account.token_expires_at <= timezone.now()
        ):
            return Response(
                {'error': 'Instagram token has expired. Please reconnect the account in Account settings.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        caption_text = post.caption or ''
        if post.hashtags:
            caption_text = f'{caption_text}\n\n{post.hashtags}'.strip()

        try:
            plaintext_token = account.decrypted_token
        except DecryptionError:
            return Response({'error': 'Publishing to Instagram failed. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)

        if not plaintext_token:
            return Response({'error': 'Publishing to Instagram failed. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)

    try:
        if is_video:
            instagram_post_id = instagram_service.publish_reel(
                plaintext_token,
                account.instagram_user_id,
                post.video_url,
                caption_text,
            )
        else:
            instagram_post_id = instagram_service.publish_image_post(
                plaintext_token,
                account.instagram_user_id,
                post.image_url,
                caption_text,
            )
    except (instagram_service.InstagramAPIError, DecryptionError) as e:
        logger.exception('publish_post_now failed for post=%s: %s', post.pk, e)
        log_action(
            request.user,
            'post_publish_failed',
            request=request,
            target=post,
            metadata={'error': 'instagram_api_error', 'detail': str(e)[:200]},
        )
        error_payload = {'error': 'Publishing to Instagram failed. Please try again.'}
        if settings.DEBUG:
            error_payload['detail'] = str(e)
        return Response(error_payload, status=status.HTTP_502_BAD_GATEWAY)
    finally:
        plaintext_token = None

    with transaction.atomic():
        try:
            post = Post.objects.select_for_update().get(pk=pk, user=request.user)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        if post.status == 'posted':
            return Response({
                'message': 'Post published to Instagram',
                'instagram_post_id': post.instagram_post_id,
                'post': post.pk,
            })
        post.status = 'posted'
        post.instagram_post_id = instagram_post_id
        post.auto_publish = False
        post.save(update_fields=['status', 'instagram_post_id', 'auto_publish', 'updated_at'])

    log_action(
        request.user,
        'post_published',
        request=request,
        target=post,
        metadata={
            'platform': 'instagram',
            'instagram_post_id': instagram_post_id,
        },
    )

    return Response({
        'message': 'Post published to Instagram',
        'instagram_post_id': instagram_post_id,
        'post': post.pk,
    })
