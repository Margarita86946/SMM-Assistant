import secrets
from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.db import transaction
from django.conf import settings
from django.utils import timezone

from .. import instagram_service, email_service
from ..models import (
    ClientInvitation, OAuthState, SocialAccount, EncryptionKey
)
from ..encryption import (
    encrypt_email, generate_secure_token, hash_token, DecryptionError
)
from ..audit import log_action, get_client_ip


INVITATION_TTL_DAYS_DEFAULT = 7


def _invitation_ttl_days():
    return int(getattr(settings, 'INVITATION_TTL_DAYS', INVITATION_TTL_DAYS_DEFAULT))


def _serialize_invitation(inv, include_email=True):
    data = {
        'id': inv.id,
        'status': inv.status,
        'created_at': inv.created_at.isoformat(),
        'expires_at': inv.expires_at.isoformat() if inv.expires_at else None,
        'accepted_at': inv.accepted_at.isoformat() if inv.accepted_at else None,
        'revoked_at': inv.revoked_at.isoformat() if inv.revoked_at else None,
        'social_account_id': inv.social_account_id,
    }
    if include_email:
        try:
            data['client_email'] = inv.decrypted_client_email
        except DecryptionError:
            data['client_email'] = ''
    return data


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def invitations_list(request):
    if request.method == 'GET':
        invitations = (
            ClientInvitation.objects
            .filter(specialist=request.user)
            .order_by('-created_at')[:200]
        )
        return Response([_serialize_invitation(inv) for inv in invitations])

    client_email = (request.data.get('client_email') or '').strip().lower()
    if not client_email or '@' not in client_email or len(client_email) > 254:
        return Response({'error': 'A valid client email is required'}, status=status.HTTP_400_BAD_REQUEST)

    raw_token = generate_secure_token()
    token_digest = hash_token(raw_token)
    expires_at = timezone.now() + timedelta(days=_invitation_ttl_days())

    try:
        encrypted_email = encrypt_email(client_email)
    except DecryptionError as e:
        return Response({'error': 'Failed to prepare invitation'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    invitation = ClientInvitation.objects.create(
        specialist=request.user,
        client_email=encrypted_email or '',
        token_hash=token_digest,
        status='pending',
        expires_at=expires_at,
        invited_ip=get_client_ip(request),
    )

    try:
        email_service.send_invitation_email(request.user, client_email, raw_token)
    except email_service.EmailDeliveryError as e:
        invitation.delete()
        return Response(
            {'error': 'Could not send invitation email. Check your email configuration in Account settings.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    email_domain = client_email.split('@', 1)[1] if '@' in client_email else ''
    log_action(
        request.user,
        'invitation_sent',
        request=request,
        target=invitation,
        metadata={'email_domain': email_domain},
    )

    return Response(_serialize_invitation(invitation), status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def invitation_detail(request, pk):
    try:
        invitation = ClientInvitation.objects.get(pk=pk, specialist=request.user)
    except ClientInvitation.DoesNotExist:
        return Response({'error': 'Invitation not found'}, status=status.HTTP_404_NOT_FOUND)

    if invitation.status != 'pending':
        return Response(
            {'error': f'Invitation cannot be revoked (status={invitation.status})'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    invitation.status = 'revoked'
    invitation.revoked_at = timezone.now()
    invitation.save(update_fields=['status', 'revoked_at'])

    log_action(
        request.user,
        'invitation_revoked',
        request=request,
        target=invitation,
        metadata={},
    )
    return Response({'message': 'Invitation revoked'})


@api_view(['GET'])
@permission_classes([AllowAny])
def invitation_lookup(request, token):
    invitation = ClientInvitation.find_by_token(token)
    if invitation is None or invitation.is_expired:
        return Response(
            {'error': 'This invitation link is invalid or has expired.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    specialist = invitation.specialist
    return Response({
        'specialist_name': (specialist.get_full_name() or specialist.username).strip(),
        'specialist_email': specialist.email,
        'client_email': invitation.decrypted_client_email,
        'expires_at': invitation.expires_at.isoformat() if invitation.expires_at else None,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def invitation_oauth_start(request, token):
    invitation = ClientInvitation.find_by_token(token)
    if invitation is None or invitation.is_expired:
        return Response(
            {'error': 'This invitation link is invalid or has expired.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    try:
        nonce = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(minutes=10)
        OAuthState.objects.filter(expires_at__lt=timezone.now()).delete()
        OAuthState.objects.filter(invitation=invitation).delete()
        OAuthState.objects.create(
            user=None,
            invitation=invitation,
            platform='instagram',
            nonce=nonce,
            expires_at=expires_at,
        )
        oauth_url = instagram_service.get_oauth_url(state=nonce)
        return Response({'oauth_url': oauth_url})
    except instagram_service.InstagramAPIError as e:
        return Response(
            {'error': 'Instagram integration is not configured'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )