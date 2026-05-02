import json
import re
import time

from django.http import StreamingHttpResponse
from rest_framework.authtoken.models import Token
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


def notifications_stream(request):
    from django.conf import settings
    from django.utils import timezone
    from ..models import TokenExpiry

    token_key = request.GET.get('token', '').strip()
    if not token_key:
        return StreamingHttpResponse(status=401)
    try:
        token = Token.objects.select_related('user').get(key=token_key)
        user = token.user
        if not user.is_active:
            return StreamingHttpResponse(status=401)
        try:
            expiry = token.expiry
            if expiry.is_revoked or expiry.expires_at <= timezone.now():
                return StreamingHttpResponse(status=401)
        except TokenExpiry.DoesNotExist:
            return StreamingHttpResponse(status=401)
    except Token.DoesNotExist:
        return StreamingHttpResponse(status=401)

    def event_stream():
        last_id = (
            Notification.objects
            .filter(recipient=user)
            .order_by('-id')
            .values_list('id', flat=True)
            .first()
        ) or 0

        yield f"data: {json.dumps({'type': 'connected'})}\n\n"

        heartbeat = 0
        while True:
            time.sleep(2)
            heartbeat += 2

            new_qs = (
                Notification.objects
                .filter(recipient=user, id__gt=last_id)
                .select_related('actor', 'post')
                .order_by('id')
            )
            for n in new_qs:
                last_id = n.id
                payload = _serialize(n)
                payload['unread_count'] = Notification.objects.filter(
                    recipient=user, is_read=False
                ).count()
                yield f"data: {json.dumps(payload)}\n\n"

            if heartbeat >= 30:
                heartbeat = 0
                yield ": heartbeat\n\n"

    origin = request.META.get('HTTP_ORIGIN', '')
    allowed_origins = set(getattr(settings, 'CORS_ALLOWED_ORIGINS', []))
    allowed_regexes = getattr(settings, 'CORS_ALLOWED_ORIGIN_REGEXES', [])

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    if origin and (origin in allowed_origins or any(re.match(r, origin) for r in allowed_regexes)):
        response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Credentials'] = 'true'
    return response
