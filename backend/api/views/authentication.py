import logging
from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.conf import settings
from django.utils import timezone

from ..models import User, TokenExpiry
from ..audit import log_action, get_client_ip
from ..serializers import UserSerializer

logger = logging.getLogger(__name__)


def _user_payload(user, expires_at=None):
    data = {
        'user_id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role,
    }
    if expires_at is not None:
        data['expires_at'] = expires_at.isoformat()
    return data


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    from ..models import ClientInvitation
    from ..encryption import hash_token

    invitation_token = (request.data.get('invitation_token') or '').strip()
    invitation = None

    if invitation_token:
        token_hash = hash_token(invitation_token)
        invitation = (
            ClientInvitation.objects
            .select_related('specialist')
            .filter(token_hash=token_hash, status='pending')
            .first()
        )
        if invitation is None or invitation.is_expired:
            return Response(
                {'error': 'This invitation link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Force the email to match the invitation so the client can't
        # register with a different address than what was invited.
        expected_email = invitation.decrypted_client_email
        submitted_email = (request.data.get('email') or '').strip().lower()
        if submitted_email != expected_email:
            return Response(
                {'error': 'The email address must match the invitation.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # Build mutable copy so we can force role without trusting the client.
    data = request.data.copy()
    if invitation:
        data['role'] = 'client'
    else:
        # Only 'owner' and 'specialist' are valid self-registration roles.
        requested_role = (request.data.get('role') or '').strip().lower()
        data['role'] = requested_role if requested_role in ('owner', 'specialist') else 'owner'

    from django.db import transaction as _tx

    # If this is an invitation and a deactivated account already exists for this
    # email, reactivate it instead of creating a duplicate.
    existing_user = None
    if invitation:
        expected_email = invitation.decrypted_client_email
        existing_user = User.objects.filter(email=expected_email, is_active=False, role='client').first()

    with _tx.atomic():
        if existing_user:
            # Reactivate: require all the same fields as fresh registration
            new_username = (data.get('username') or '').strip()
            new_password = (data.get('password') or '').strip()

            if not new_username:
                return Response({'error': 'Username is required.'}, status=status.HTTP_400_BAD_REQUEST)
            if not new_password:
                return Response({'error': 'Password is required.'}, status=status.HTTP_400_BAD_REQUEST)

            # Username must match the existing account — prevents someone else hijacking via invite
            if new_username != existing_user.username:
                return Response(
                    {'error': 'Username does not match the account associated with this invitation.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                validate_password(new_password, existing_user)
            except DjangoValidationError as e:
                return Response({'password': list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

            existing_user.set_password(new_password)
            existing_user.is_active = True
            existing_user.specialist = invitation.specialist
            existing_user.first_name = data.get('first_name', existing_user.first_name)
            existing_user.last_name = data.get('last_name', existing_user.last_name)
            existing_user.save(update_fields=[
                'password', 'is_active', 'specialist_id', 'first_name', 'last_name'
            ])
            user = existing_user
        else:
            serializer = UserSerializer(data=data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            user = serializer.save()
            user.role = data['role']
            if invitation:
                user.specialist = invitation.specialist
            user.save(update_fields=['role', 'specialist_id'])

        token, _ = Token.objects.get_or_create(user=user)
        expires_at = timezone.now() + timedelta(days=settings.TOKEN_EXPIRY_DAYS)
        TokenExpiry.objects.update_or_create(
            token=token,
            defaults={'expires_at': expires_at, 'is_revoked': False},
        )

        if invitation:
            # Clear any previous invitation's client FK for this user so the
            # OneToOneField constraint doesn't conflict when we link the new one.
            from ..models import ClientInvitation as _CI
            _CI.objects.filter(client=user).exclude(pk=invitation.pk).update(client=None)

            invitation.status = 'accepted'
            invitation.accepted_at = timezone.now()
            invitation.accepted_ip = get_client_ip(request)
            invitation.client = user
            invitation.save(update_fields=['status', 'accepted_at', 'accepted_ip', 'client'])

    return Response({
        'token': token.key,
        **_user_payload(user, expires_at),
        'message': 'User registered successfully',
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    try:
        db_user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response(
            {'error': 'user_not_found'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not db_user.is_active:
        return Response(
            {'error': 'account_disabled'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    user = authenticate(username=username, password=password)

    if user is None:
        return Response(
            {'error': 'wrong_password'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    from django.db import transaction as _tx
    with _tx.atomic():
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])
        token, _ = Token.objects.get_or_create(user=user)
        expires_at = timezone.now() + timedelta(days=settings.TOKEN_EXPIRY_DAYS)
        TokenExpiry.objects.update_or_create(
            token=token,
            defaults={'expires_at': expires_at, 'is_revoked': False}
        )

    log_action(user, 'login', request=request)

    return Response({
        'token': token.key,
        **_user_payload(user, expires_at),
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        token = request.user.auth_token
        TokenExpiry.objects.update_or_create(
            token=token,
            defaults={'is_revoked': True, 'expires_at': timezone.now()}
        )
        log_action(request.user, 'logout', request=request)
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    user = request.user
    if request.method == 'GET':
        return Response({
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
            'avatar': user.avatar,
            'role': user.role,
            'auto_approve': user.auto_approve,
            'notifications_sound': user.notifications_sound,
        })
    allowed_fields = ['first_name', 'last_name', 'email', 'avatar', 'auto_approve', 'notifications_sound']
    data = {k: v for k, v in request.data.items() if k in allowed_fields}
    if 'email' in data and data['email'] != user.email:
        if User.objects.filter(email=data['email']).exclude(pk=user.pk).exists():
            return Response({'error': 'email_taken'}, status=status.HTTP_400_BAD_REQUEST)
    if 'avatar' in data:
        avatar_val = data['avatar']
        if avatar_val and not avatar_val.startswith('data:image/'):
            return Response({'error': 'Invalid image format'}, status=status.HTTP_400_BAD_REQUEST)
        if avatar_val and len(avatar_val) > 2_000_000:
            return Response({'error': 'avatar_too_large'}, status=status.HTTP_400_BAD_REQUEST)
    bool_fields = {'auto_approve', 'notifications_sound'}
    for key, value in data.items():
        if key in bool_fields:
            value = value if isinstance(value, bool) else str(value).lower() not in ('false', '0', '')
        setattr(user, key, value)
    user.save(update_fields=list(data.keys()))
    return Response({
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'date_joined': user.date_joined,
        'last_login': user.last_login,
        'avatar': user.avatar,
        'role': user.role,
        'auto_approve': user.auto_approve,
        'notifications_sound': user.notifications_sound,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    current_password = request.data.get('current_password', '')
    new_password = request.data.get('new_password', '')
    if not current_password or not new_password:
        return Response({'error': 'Both fields are required'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.check_password(current_password):
        return Response({'error': 'wrong_current_password'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new_password, user)
    except DjangoValidationError as e:
        return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(new_password)
    user.save()
    try:
        token = user.auth_token
        TokenExpiry.objects.update_or_create(
            token=token,
            defaults={'is_revoked': True, 'expires_at': timezone.now()}
        )
    except Exception:
        pass
    log_action(user, 'password_changed', request=request)
    return Response({'message': 'Password changed successfully. Please log in again.'})