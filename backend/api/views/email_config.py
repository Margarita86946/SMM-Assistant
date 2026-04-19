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
        'provider': cfg.provider,
        'smtp_host': cfg.smtp_host,
        'smtp_port': cfg.smtp_port,
        'smtp_user': cfg.smtp_user,
        'from_name': cfg.from_name,
        'from_email': cfg.from_email,
        'is_verified': cfg.is_verified,
        'last_test_sent': cfg.last_test_sent.isoformat() if cfg.last_test_sent else None,
        'updated_at': cfg.updated_at.isoformat(),
    }


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def email_config_view(request):
    if request.method == 'GET':
        try:
            cfg = request.user.email_config
        except EmailConfiguration.DoesNotExist:
            return Response({'configured': False})
        return Response({'configured': True, **_serialize_email_config(cfg)})

    if request.method == 'DELETE':
        try:
            cfg = request.user.email_config
        except EmailConfiguration.DoesNotExist:
            return Response({'message': 'No email configuration to remove.'})
        cfg.delete()
        log_action(
            request.user,
            'credentials_updated',
            request=request,
            metadata={'component': 'email_config', 'action': 'removed'},
        )
        return Response({'message': 'Email configuration removed.'})

    provider = (request.data.get('provider') or 'gmail').lower()
    if provider not in dict(EmailConfiguration.PROVIDER_CHOICES):
        return Response({'error': 'Invalid provider'}, status=status.HTTP_400_BAD_REQUEST)
    smtp_host = (request.data.get('smtp_host') or '').strip() or 'smtp.gmail.com'
    try:
        smtp_port = int(request.data.get('smtp_port') or 587)
    except (TypeError, ValueError):
        return Response({'error': 'smtp_port must be an integer'}, status=status.HTTP_400_BAD_REQUEST)
    smtp_user = (request.data.get('smtp_user') or '').strip().lower()
    smtp_password = request.data.get('smtp_password') or ''
    from_name = (request.data.get('from_name') or '').strip()
    from_email = (request.data.get('from_email') or '').strip().lower()

    if not smtp_user or '@' not in smtp_user:
        return Response({'error': 'smtp_user must be a valid email'}, status=status.HTTP_400_BAD_REQUEST)
    if not from_email or '@' not in from_email:
        return Response({'error': 'from_email must be a valid email'}, status=status.HTTP_400_BAD_REQUEST)
    if not from_name:
        return Response({'error': 'from_name is required'}, status=status.HTTP_400_BAD_REQUEST)
    if not smtp_password:
        existing = EmailConfiguration.objects.filter(user=request.user).first()
        if existing is None:
            return Response({'error': 'smtp_password is required'}, status=status.HTTP_400_BAD_REQUEST)

    active_key = EncryptionKey.get_active()
    try:
        if smtp_password:
            encrypted_pw = encrypt(smtp_password, active_key.id)
        else:
            encrypted_pw = None
    except DecryptionError as e:
        return Response({'error': 'Failed to secure credentials'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    defaults = {
        'provider': provider,
        'smtp_host': smtp_host,
        'smtp_port': smtp_port,
        'smtp_user': smtp_user,
        'from_name': from_name,
        'from_email': from_email,
        'encryption_key': active_key,
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
    except email_service.EmailDeliveryError as e:
        test_error = 'Test email failed. Credentials were saved but not verified.'

    cfg.is_verified = verified
    cfg.last_test_sent = timezone.now()
    cfg.save(update_fields=['is_verified', 'last_test_sent'])

    log_action(
        request.user,
        'credentials_updated',
        request=request,
        metadata={'component': 'email_config', 'verified': verified, 'provider': provider},
    )

    response_body = {'configured': True, **_serialize_email_config(cfg)}
    if test_error:
        response_body['warning'] = test_error
    return Response(response_body)