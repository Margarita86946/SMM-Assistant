import logging

from django.db import transaction

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
    """Write an audit log entry in its own savepoint so it is never rolled back
    by an outer transaction.  Callers should invoke this *outside* any
    transaction.atomic() block so that the log row commits independently."""
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

        # Use a nested atomic block (savepoint) so a failure here never aborts
        # the caller's transaction, and so the row is visible immediately.
        with transaction.atomic():
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
