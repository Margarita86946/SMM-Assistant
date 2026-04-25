from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from django.db.models import Q
from django.utils import timezone
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.conf import settings

import os
import uuid
import mimetypes

from ..models import Post, Notification
from ..serializers import PostSerializer, PostCreateSerializer


class StablePageNumberPagination(PageNumberPagination):
    page_size = 3
    page_size_query_param = 'page_size'
    max_page_size = 100
    min_page_size = 1

    def get_page_size(self, request):
        size = super().get_page_size(request)
        if size is not None:
            return max(self.min_page_size, size)
        return size

    def paginate_queryset(self, queryset, request, view=None):
        queryset = queryset.order_by('-created_at', '-id')
        return super().paginate_queryset(queryset, request, view)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def posts_list(request):
    if request.method == 'GET':
        if request.user.role == 'client':
            posts = (
                Post.objects
                .filter(client=request.user, deleted_at__isnull=True)
                .select_related('user', 'client')
                .order_by('-created_at')
            )
        else:
            posts = (
                Post.objects
                .filter(user=request.user, deleted_at__isnull=True)
                .select_related('user', 'client')
                .order_by('-created_at')
            )

        search = request.query_params.get('search', '').strip()
        platform = request.query_params.get('platform', '').strip()
        post_status = request.query_params.get('status', '').strip()
        client_id = request.query_params.get('client_id', '').strip()

        if client_id and request.user.role != 'client':
            try:
                from ..models import User
                client = User.objects.get(id=int(client_id), specialist=request.user, role='client')
                posts = posts.filter(client=client)
            except (User.DoesNotExist, ValueError):
                pass

        if search:
            posts = posts.filter(
                Q(caption__icontains=search) |
                Q(hashtags__icontains=search) |
                Q(topic__icontains=search)
            )
        if platform:
            posts = posts.filter(platform=platform)
        if post_status:
            if post_status == 'approved':
                posts = posts.filter(status__in=['approved', 'ready_to_post'])
            else:
                posts = posts.filter(status=post_status)

        paginator = StablePageNumberPagination()
        page = paginator.paginate_queryset(posts, request)
        serializer = PostSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    elif request.method == 'POST':
        serializer = PostCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            post = serializer.save(user=request.user)
            return Response(PostSerializer(post).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def post_detail(request, pk):
    if request.user.role == 'client':
        if request.method != 'GET':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        try:
            post = Post.objects.select_related('user', 'client').get(pk=pk, client=request.user, deleted_at__isnull=True)
        except Post.DoesNotExist:
            return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PostSerializer(post).data)

    try:
        post = Post.objects.select_related('user', 'client').get(pk=pk, user=request.user, deleted_at__isnull=True)
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(PostSerializer(post).data)

    elif request.method == 'PUT':
        _CONTENT_FIELDS = ('caption', 'hashtags', 'image_prompt', 'topic', 'platform')
        old_status = post.status
        old_content = {f: getattr(post, f, '') or '' for f in _CONTENT_FIELDS}

        serializer = PostCreateSerializer(post, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated = serializer.save()
            if old_status in ('scheduled', 'approved', 'ready_to_post'):
                new_content = {f: getattr(updated, f, '') or '' for f in _CONTENT_FIELDS}
                content_changed = any(old_content[f] != new_content[f] for f in _CONTENT_FIELDS)
                explicit_status = (request.data.get('status') or '').strip()
                if content_changed and explicit_status not in ('draft', 'pending_approval'):
                    updated.status = 'pending_approval'
                    updated.approval_note = ''
                    updated.save(update_fields=['status', 'approval_note', 'updated_at'])
                    if updated.client_id:
                        Notification.objects.create(
                            recipient=updated.client,
                            actor=request.user,
                            notification_type='post_submitted',
                            post=updated,
                        )
            return Response(PostSerializer(updated).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        post.deleted_at = timezone.now()
        post.save(update_fields=['deleted_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calendar_view(request):
    if request.user.role == 'client':
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    from django.utils import timezone
    import zoneinfo

    month = request.GET.get('month')
    year = request.GET.get('year')
    tz_name = request.GET.get('tz', 'UTC')

    if not month or not year:
        return Response({'error': 'Month and year are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        month = int(month)
        year = int(year)
        user_tz = zoneinfo.ZoneInfo(tz_name)
    except (ValueError, zoneinfo.ZoneInfoNotFoundError):
        return Response({'error': 'Invalid month, year, or timezone'}, status=status.HTTP_400_BAD_REQUEST)

    import calendar as _cal
    last_day = _cal.monthrange(year, month)[1]
    month_start = timezone.datetime(year, month, 1, 0, 0, 0, tzinfo=user_tz)
    month_end = timezone.datetime(year, month, last_day, 23, 59, 59, tzinfo=user_tz)

    qs = Post.objects.filter(
        user=request.user,
        scheduled_time__gte=month_start,
        scheduled_time__lte=month_end,
        deleted_at__isnull=True,
    ).select_related('user', 'client')

    client_id = request.GET.get('client_id', '').strip()
    if client_id:
        try:
            from ..models import User
            client = User.objects.get(id=int(client_id), specialist=request.user, role='client')
            qs = qs.filter(client=client)
        except (User.DoesNotExist, ValueError):
            pass

    serializer = PostSerializer(qs.order_by('scheduled_time'), many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def today_posts(request):
    if request.user.role == 'client':
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
    from django.utils import timezone

    today = timezone.now().date()

    posts = Post.objects.filter(
        user=request.user,
        scheduled_time__date=today,
        deleted_at__isnull=True,
    ).select_related('user', 'client').order_by('scheduled_time')

    return Response(PostSerializer(posts, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_post_image(request):
    file = request.FILES.get('image')
    if not file:
        return Response({'error': 'No image file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    allowed = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    mime = file.content_type or mimetypes.guess_type(file.name)[0] or ''
    if mime not in allowed:
        return Response({'error': 'Unsupported file type. Use JPEG, PNG, WEBP, or GIF.'}, status=status.HTTP_400_BAD_REQUEST)

    if file.size > 10 * 1024 * 1024:
        return Response({'error': 'File too large. Maximum size is 10 MB.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = os.path.splitext(file.name)[1].lower() or '.jpg'
    filename = f"post_images/{uuid.uuid4().hex}{ext}"
    saved_path = default_storage.save(filename, ContentFile(file.read()))

    url = request.build_absolute_uri(settings.MEDIA_URL + saved_path)
    return Response({'image_url': url}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_post_video(request):
    file = request.FILES.get('video')
    if not file:
        return Response({'error': 'No video file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    allowed = {'video/mp4', 'video/quicktime', 'video/x-m4v'}
    mime = file.content_type or mimetypes.guess_type(file.name)[0] or ''
    if mime not in allowed:
        return Response({'error': 'Unsupported file type. Use MP4 or MOV.'}, status=status.HTTP_400_BAD_REQUEST)

    if file.size > 500 * 1024 * 1024:
        return Response({'error': 'File too large. Maximum size is 500 MB.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = os.path.splitext(file.name)[1].lower() or '.mp4'
    filename = f"post_videos/{uuid.uuid4().hex}{ext}"
    saved_path = default_storage.save(filename, ContentFile(file.read()))

    url = request.build_absolute_uri(settings.MEDIA_URL + saved_path)
    return Response({'video_url': url}, status=status.HTTP_201_CREATED)
