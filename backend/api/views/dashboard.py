from collections import Counter
from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from ..models import Post, User


def _client_filtered_posts(request):
    qs = Post.objects.filter(user=request.user)
    client_id = request.query_params.get('client_id', '').strip()
    if client_id and request.user.role != 'client':
        try:
            client_id_int = int(client_id)
            if User.objects.filter(id=client_id_int, specialist=request.user, role='client').exists():
                qs = qs.filter(client_id=client_id_int)
        except ValueError:
            pass
    return qs


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    if request.user.role == 'client':
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    user_posts = _client_filtered_posts(request)
    total_posts = user_posts.count()

    now = timezone.now()
    days_until_next_monday = 7 - now.weekday()
    start_of_next_week = (now + timedelta(days=days_until_next_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    posts_this_week = user_posts.filter(
        scheduled_time__gte=now,
        scheduled_time__lt=start_of_next_week
    ).count()

    draft_posts = user_posts.filter(status='draft').count()
    scheduled_posts = user_posts.filter(status='scheduled').count()
    pending_approval_posts = user_posts.filter(status='pending_approval').count()
    approved_posts = user_posts.filter(status='approved').count()
    rejected_posts = user_posts.filter(status='rejected').count()
    posted_posts = user_posts.filter(status='posted').count()

    hashtags_list = []
    for (raw,) in user_posts.exclude(hashtags='').values_list('hashtags'):
        hashtags_list.extend(raw.split())

    hashtag_counts = Counter(hashtags_list)
    most_used_hashtags = [
        {'tag': tag, 'count': count}
        for tag, count in hashtag_counts.most_common(5)
    ]

    return Response({
        'total_posts': total_posts,
        'posts_this_week': posts_this_week,
        'draft_posts': draft_posts,
        'scheduled_posts': scheduled_posts,
        'pending_approval_posts': pending_approval_posts,
        'approved_posts': approved_posts,
        'rejected_posts': rejected_posts,
        'posted_posts': posted_posts,
        'most_used_hashtags': most_used_hashtags,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_activity(request):
    if request.user.role == 'client':
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    today = timezone.now().date()
    start = today - timedelta(days=6)

    rows = (
        _client_filtered_posts(request)
        .filter(created_at__date__gte=start)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    counts_by_day = {row['day']: row['count'] for row in rows}

    result = []
    for i in range(7):
        d = start + timedelta(days=i)
        result.append({'date': d.isoformat(), 'count': counts_by_day.get(d, 0)})
    return Response(result)
