from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.conf import settings
from django.utils import timezone

from .. import email_service
from ..models import ClientInvitation, User
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

    # If this client email already has a platform account linked to this specialist, block re-invite.
    if User.objects.filter(email=client_email, specialist=request.user, role='client').exists():
        return Response(
            {'error': 'This client has already registered on the platform.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    raw_token = generate_secure_token()
    token_digest = hash_token(raw_token)
    expires_at = timezone.now() + timedelta(days=_invitation_ttl_days())

    try:
        encrypted_email = encrypt_email(client_email)
    except DecryptionError:
        return Response({'error': 'Failed to prepare invitation'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Send the email BEFORE writing to the DB — if delivery fails we never
    # create an orphaned invitation row that can't be revoked.
    try:
        email_service.send_invitation_email(request.user, client_email, raw_token)
    except email_service.EmailDeliveryError:
        return Response(
            {'error': 'Could not send invitation email. Check your email configuration in Account settings.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    # Revoke any previous pending invitations for this email from this specialist
    # so the old link can't be used after a re-invite.
    ClientInvitation.objects.filter(
        specialist=request.user,
        status='pending',
    ).exclude(token_hash=token_digest).filter(
        client_email=encrypted_email or '',
    ).update(status='revoked', revoked_at=timezone.now())

    invitation = ClientInvitation.objects.create(
        specialist=request.user,
        client_email=encrypted_email or '',
        token_hash=token_digest,
        status='pending',
        expires_at=expires_at,
        invited_ip=get_client_ip(request),
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
    client_email = invitation.decrypted_client_email

    # Check if this email belongs to a deactivated account so the frontend
    # can pre-fill and lock the username field.
    existing_username = None
    existing = User.objects.filter(email=client_email, is_active=False, role='client').first()
    if existing:
        existing_username = existing.username

    return Response({
        'specialist_name': (specialist.get_full_name() or specialist.username).strip(),
        'specialist_email': specialist.email,
        'client_email': client_email,
        'expires_at': invitation.expires_at.isoformat() if invitation.expires_at else None,
        'existing_username': existing_username,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def clients_list(request):
    if request.user.role not in ('specialist',):
        return Response({'error': 'Only specialists can view their clients.'}, status=status.HTTP_403_FORBIDDEN)

    clients = (
        User.objects
        .filter(specialist=request.user, role='client')
        .order_by('date_joined')
    )
    data = [
        {
            'id': c.id,
            'username': c.username,
            'email': c.email,
            'first_name': c.first_name,
            'last_name': c.last_name,
            'date_joined': c.date_joined.isoformat(),
        }
        for c in clients
    ]
    return Response(data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def client_detail(request, pk):
    """Remove a client from this specialist's workspace.
    - Deactivates the client's platform account (can't log in)
    - Disconnects their Instagram
    - Unassigns their posts
    - Sends them a notification email
    """
    if request.user.role != 'specialist':
        return Response({'error': 'Only specialists can remove clients.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        client = User.objects.get(pk=pk, specialist=request.user, role='client')
    except User.DoesNotExist:
        return Response({'error': 'Client not found.'}, status=status.HTTP_404_NOT_FOUND)

    from django.db import transaction
    from ..models import SocialAccount, Post
    with transaction.atomic():
        # Unlink specialist and deactivate account
        client.specialist = None
        client.is_active = False
        client.save(update_fields=['specialist_id', 'is_active'])

        # Disconnect all Instagram accounts belonging to this client
        SocialAccount.objects.filter(user=client, platform='instagram').update(is_active=False)

        # Unassign any posts this specialist created for this client
        Post.objects.filter(user=request.user, client=client).update(client=None)

    # Send notification email (non-fatal if delivery fails)
    email_service.send_client_removed_email(request.user, client)

    log_action(
        request.user,
        'client_removed',
        request=request,
        target=client,
        metadata={'client_id': client.id, 'client_username': client.username},
    )

    return Response({'message': 'Client removed from your workspace.'})