from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.utils import timezone

from .. import email_service
from ..models import EmailConfiguration, EncryptionKey
from ..encryption import encrypt, DecryptionError
from ..audit import log_action


def _serialize_email_config(cfg):
    return {
        'from_email': cfg.from_email,
        'from_name': cfg.from_name,
        'is_verified': cfg.is_verified,
        'last_test_sent': cfg.last_test_sent.isoformat() if cfg.last_test_sent else None,
    }


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def email_config_view(request):
    if request.method == 'GET':
        cfg = EmailConfiguration.objects.filter(user=request.user, is_active=True).first()
        if cfg is None:
            return Response({'configured': False})
        return Response({'configured': True, **_serialize_email_config(cfg)})

    if request.method == 'DELETE':
        cfg = EmailConfiguration.objects.filter(user=request.user, is_active=True).first()
        if cfg is None:
            return Response({'message': 'No email configuration to remove.'})
        cfg.is_active = False
        cfg.save(update_fields=['is_active'])
        log_action(
            request.user,
            'credentials_updated',
            request=request,
            metadata={'component': 'email_config', 'action': 'removed'},
        )
        return Response({'message': 'Email configuration removed.'})

    # POST — only requires app_password; everything else is derived from the user's account
    app_password = (request.data.get('app_password') or '').strip()
    if not app_password:
        existing = EmailConfiguration.objects.filter(user=request.user, is_active=True).first()
        if existing is None:
            return Response(
                {'error': 'App password is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    user_email = request.user.email
    if not user_email or '@' not in user_email:
        return Response(
            {'error': 'Your account has no email address. Add one in Account settings first.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from_name = (request.user.get_full_name() or request.user.username).strip()

    active_key = EncryptionKey.get_active()
    encrypted_pw = None
    if app_password:
        try:
            encrypted_pw = encrypt(app_password, active_key.id)
        except DecryptionError:
            return Response(
                {'error': 'Failed to secure credentials.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    defaults = {
        'provider': 'gmail',
        'smtp_host': 'smtp.gmail.com',
        'smtp_port': 587,
        'smtp_user': user_email,
        'from_name': from_name,
        'from_email': user_email,
        'encryption_key': active_key,
        'is_active': True,
    }
    if encrypted_pw is not None:
        defaults['smtp_password_encrypted'] = encrypted_pw

    cfg, _ = EmailConfiguration.objects.update_or_create(
        user=request.user,
        defaults=defaults,
    )

    verified = False
    test_error = None
    try:
        email_service.send_test_email(cfg)
        verified = True
    except email_service.EmailDeliveryError:
        test_error = 'Could not verify — check that the App Password is correct.'

    cfg.is_verified = verified
    cfg.last_test_sent = timezone.now()
    cfg.save(update_fields=['is_verified', 'last_test_sent'])

    log_action(
        request.user,
        'credentials_updated',
        request=request,
        metadata={'component': 'email_config', 'verified': verified},
    )

    response_body = {'configured': True, **_serialize_email_config(cfg)}
    if test_error:
        response_body['warning'] = test_error
    return Response(response_body)
