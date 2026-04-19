from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from django.db.models import Q

from ..models import Post
from ..serializers import PostSerializer, PostCreateSerializer


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def posts_list(request):
    if request.method == 'GET':
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
        if post_status:
            posts = posts.filter(status=post_status)

        paginator = PageNumberPagination()
        paginator.page_size = 3
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
        serializer = PostCreateSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(PostSerializer(serializer.instance).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calendar_view(request):
    month = request.GET.get('month')
    year = request.GET.get('year')

    if not month or not year:
        return Response({'error': 'Month and year are required'}, status=status.HTTP_400_BAD_REQUEST)

    posts = Post.objects.filter(
        user=request.user,
        scheduled_time__month=month,
        scheduled_time__year=year
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