from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import AuditLog


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_logs_view(request):
    qs = AuditLog.objects.filter(workspace_user=request.user).order_by('-created_at')
    action_filter = (request.query_params.get('action') or '').strip()
    if action_filter:
        qs = qs.filter(action=action_filter)
    entries = list(qs[:50])
    return Response([
        {
            'id': e.id,
            'action': e.action,
            'target_type': e.target_type,
            'target_id': e.target_id,
            'metadata': e.metadata or {},
            'ip_address': e.ip_address,
            'created_at': e.created_at.isoformat(),
        }
        for e in entries
    ])