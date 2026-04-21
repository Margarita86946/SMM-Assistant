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
    serializer = UserSerializer(data=request.data)

    if serializer.is_valid():
        from django.db import transaction as _tx
        with _tx.atomic():
            user = serializer.save()
            role = request.data.get('role')
            if role in {'specialist', 'client'} and user.role != role:
                user.role = role
                user.save(update_fields=['role'])

            token, _ = Token.objects.get_or_create(user=user)
            expires_at = timezone.now() + timedelta(days=settings.TOKEN_EXPIRY_DAYS)
            TokenExpiry.objects.create(token=token, expires_at=expires_at)

        return Response({
            'token': token.key,
            **_user_payload(user, expires_at),
            'message': 'User registered successfully',
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    try:
        User.objects.get(username=username)
    except User.DoesNotExist:
        return Response(
            {'error': 'user_not_found'},
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
        })
    allowed_fields = ['first_name', 'last_name', 'email', 'avatar']
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
    for key, value in data.items():
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