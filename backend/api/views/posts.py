from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from django.db.models import Q

from ..models import Post
from ..serializers import PostSerializer, PostCreateSerializer


class StablePageNumberPagination(PageNumberPagination):
    """PageNumberPagination with a stable (created_at, id) sort enforced so
    that concurrent inserts during pagination never push a row to a different
    page offset.  The queryset must already be ordered by -created_at; this
    class appends -id as a tie-breaker before handing off to the DB."""

    page_size = 3
    page_size_query_param = 'page_size'
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        # Append -id as a deterministic tie-breaker on top of whatever
        # ordering the caller set.  Two posts created in the same second get
        # a fixed, repeatable order so the offset never shifts between pages.
        queryset = queryset.order_by('-created_at', '-id')
        return super().paginate_queryset(queryset, request, view)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def posts_list(request):
    if request.method == 'GET':
        if request.user.role == 'client':
            # Clients see all posts currently pending their approval
            posts = Post.objects.filter(status='pending_approval').order_by('-created_at')
        else:
            posts = Post.objects.filter(user=request.user).order_by('-created_at')

        search = request.query_params.get('search', '').strip()
        platform = request.query_params.get('platform', '').strip()
        post_status = request.query_params.get('status', '').strip()

        if search:
            posts = posts.filter(
                Q(caption__icontains=search) |
                Q(hashtags__icontains=search) |
                Q(topic__icontains=search)
            )
        if platform:
            posts = posts.filter(platform=platform)
        if post_status and request.user.role != 'client':
            # treat 'approved' and legacy 'ready_to_post' as the same bucket
            if post_status == 'approved':
                posts = posts.filter(status__in=['approved', 'ready_to_post'])
            else:
                posts = posts.filter(status=post_status)

        paginator = StablePageNumberPagination()
        page = paginator.paginate_queryset(posts, request)
        serializer = PostSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == 'POST':
        serializer = PostCreateSerializer(data=request.data)
        if serializer.is_valid():
            post = serializer.save(user=request.user)
            return Response(PostSerializer(post).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def post_detail(request, pk):
    try:
        post = Post.objects.get(pk=pk, user=request.user)
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = PostSerializer(post)
        return Response(serializer.data)

    elif request.method == 'PUT':
        _CONTENT_FIELDS = ('caption', 'hashtags', 'image_prompt', 'topic', 'platform')
        old_status = post.status
        old_content = {f: getattr(post, f, '') or '' for f in _CONTENT_FIELDS}

        serializer = PostCreateSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            updated = serializer.save()
            # If a scheduled/approved post has content edits (not just time change),
            # require re-approval so the client sees the changes before it goes live.
            if old_status in ('scheduled', 'approved', 'ready_to_post'):
                new_content = {f: getattr(updated, f, '') or '' for f in _CONTENT_FIELDS}
                content_changed = any(old_content[f] != new_content[f] for f in _CONTENT_FIELDS)
                explicit_status = (request.data.get('status') or '').strip()
                if content_changed and explicit_status not in ('draft', 'pending_approval'):
                    updated.status = 'pending_approval'
                    updated.approval_note = ''
                    updated.save(update_fields=['status', 'approval_note', 'updated_at'])
            return Response(PostSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calendar_view(request):
    from django.utils import timezone
    import zoneinfo

    month = request.GET.get('month')
    year  = request.GET.get('year')
    tz_name = request.GET.get('tz', 'UTC')

    if not month or not year:
        return Response({'error': 'Month and year are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        month = int(month)
        year  = int(year)
        user_tz = zoneinfo.ZoneInfo(tz_name)
    except (ValueError, zoneinfo.ZoneInfoNotFoundError):
        return Response({'error': 'Invalid month, year, or timezone'}, status=status.HTTP_400_BAD_REQUEST)

    # Build UTC range covering the full calendar month in the user's local timezone
    import calendar as _cal
    last_day = _cal.monthrange(year, month)[1]
    month_start = timezone.datetime(year, month, 1, 0, 0, 0, tzinfo=user_tz)
    month_end   = timezone.datetime(year, month, last_day, 23, 59, 59, tzinfo=user_tz)

    posts = Post.objects.filter(
        user=request.user,
        scheduled_time__gte=month_start,
        scheduled_time__lte=month_end,
    ).order_by('scheduled_time')

    serializer = PostSerializer(posts, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def today_posts(request):
    from django.utils import timezone

    today = timezone.now().date()

    posts = Post.objects.filter(
        user=request.user,
        scheduled_time__date=today
    ).order_by('scheduled_time')

    serializer = PostSerializer(posts, many=True)
    return Response(serializer.data)