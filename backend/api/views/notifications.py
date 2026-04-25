from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import Notification


def _serialize(n):
    return {
        'id': n.id,
        'type': n.notification_type,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat(),
        'post_id': n.post_id,
        'actor_name': (
            ' '.join(filter(None, [n.actor.first_name, n.actor.last_name])) or n.actor.username
            if n.actor else None
        ),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def notifications_list(request):
    qs = (
        Notification.objects
        .filter(recipient=request.user)
        .select_related('actor', 'post')
        .only(
            'id', 'notification_type', 'is_read', 'created_at', 'post_id',
            'actor__id', 'actor__first_name', 'actor__last_name', 'actor__username',
        )
        .order_by('-created_at')[:20]
    )
    unread_count = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({
        'unread_count': unread_count,
        'notifications': [_serialize(n) for n in qs],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request, pk):
    updated = Notification.objects.filter(pk=pk, recipient=request.user).update(is_read=True)
    if not updated:
        return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'ok': True})
