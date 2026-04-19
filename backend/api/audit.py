import logging

from .models import AuditLog

logger = logging.getLogger('api')


def get_client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip() or None
    return request.META.get('REMOTE_ADDR') or None


def log_action(user, action, request=None, target=None, metadata=None):
    try:
        ip = get_client_ip(request) if request is not None else None
        ua = ''
        if request is not None:
            ua = (request.META.get('HTTP_USER_AGENT') or '')[:500]

        target_type = ''
        target_id = None
        if target is not None:
            target_type = target.__class__.__name__
            target_id = getattr(target, 'pk', None)

        AuditLog.objects.create(
            workspace_user=user if getattr(user, 'is_authenticated', False) else None,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata=metadata or {},
            ip_address=ip,
            user_agent=ua,
        )
    except Exception as e:
        logger.error('Audit log failed for action=%s: %s', action, e)
