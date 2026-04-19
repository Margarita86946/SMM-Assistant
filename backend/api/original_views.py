import os
import logging
import requests as http_requests
from collections import Counter
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework.authtoken.models import Token
from django.conf import settings
from .models import Post, User, TokenExpiry
from .serializers import PostSerializer, PostCreateSerializer, UserSerializer
from datetime import timedelta
from django.utils import timezone
from .ai_service import generate_all_content, polish_content

logger = logging.getLogger(__name__)

VALID_PLATFORMS = {'instagram', 'linkedin', 'twitter'}
VALID_TONES = {'professional', 'casual', 'funny', 'inspirational'}


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = UserSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        token, _ = Token.objects.get_or_create(user=user)
        expires_at = timezone.now() + timedelta(days=settings.TOKEN_EXPIRY_DAYS)
        TokenExpiry.objects.create(token=token, expires_at=expires_at)

        return Response({
            'token': token.key,
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'expires_at': expires_at.isoformat(),
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    try:
        User.objects.get(username=username)
    except User.DoesNotExist:
        return Response(
            {'error': 'user_not_found'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    user = authenticate(username=username, password=password)

    if user is None:
        return Response(
            {'error': 'wrong_password'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])

    token, _ = Token.objects.get_or_create(user=user)
    expires_at = timezone.now() + timedelta(days=settings.TOKEN_EXPIRY_DAYS)
    TokenExpiry.objects.update_or_create(
        token=token,
        defaults={'expires_at': expires_at, 'is_revoked': False}
    )

    return Response({
        'token': token.key,
        'user_id': user.id,
        'username': user.username,
        'email': user.email,
        'expires_at': expires_at.isoformat(),
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        token = request.user.auth_token
        TokenExpiry.objects.update_or_create(
            token=token,
            defaults={'is_revoked': True, 'expires_at': timezone.now()}
        )
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    user = request.user
    if request.method == 'GET':
        return Response({
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'date_joined': user.date_joined,
            'last_login': user.last_login,
            'avatar': user.avatar,
        })
    allowed_fields = ['first_name', 'last_name', 'email', 'avatar']
    data = {k: v for k, v in request.data.items() if k in allowed_fields}
    if 'email' in data and data['email'] != user.email:
        if User.objects.filter(email=data['email']).exclude(pk=user.pk).exists():
            return Response({'error': 'email_taken'}, status=status.HTTP_400_BAD_REQUEST)
    if 'avatar' in data:
        avatar_val = data['avatar']
        if avatar_val and not avatar_val.startswith('data:image/'):
            return Response({'error': 'Invalid image format'}, status=status.HTTP_400_BAD_REQUEST)
        if avatar_val and len(avatar_val) > 2_000_000:
            return Response({'error': 'avatar_too_large'}, status=status.HTTP_400_BAD_REQUEST)
    for key, value in data.items():
        setattr(user, key, value)
    user.save(update_fields=list(data.keys()))
    return Response({
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'date_joined': user.date_joined,
        'last_login': user.last_login,
        'avatar': user.avatar,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    current_password = request.data.get('current_password', '')
    new_password = request.data.get('new_password', '')
    if not current_password or not new_password:
        return Response({'error': 'Both fields are required'}, status=status.HTTP_400_BAD_REQUEST)
    if not user.check_password(current_password):
        return Response({'error': 'wrong_current_password'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new_password, user)
    except DjangoValidationError as e:
        return Response({'error': ' '.join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(new_password)
    user.save()
    try:
        token = user.auth_token
        TokenExpiry.objects.update_or_create(
            token=token,
            defaults={'is_revoked': True, 'expires_at': timezone.now()}
        )
    except Exception:
        pass
    return Response({'message': 'Password changed successfully. Please log in again.'})


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
    today = timezone.now().date()

    posts = Post.objects.filter(
        user=request.user,
        scheduled_time__date=today
    ).order_by('scheduled_time')

    serializer = PostSerializer(posts, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    total_posts = Post.objects.filter(user=request.user).count()

    now = timezone.now()
    days_until_next_monday = 7 - now.weekday()  # weekday(): Mon=0, Sun=6
    start_of_next_week = (now + timedelta(days=days_until_next_monday)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    posts_this_week = Post.objects.filter(
        user=request.user,
        scheduled_time__gte=now,
        scheduled_time__lt=start_of_next_week
    ).count()

    draft_posts = Post.objects.filter(user=request.user, status='draft').count()
    scheduled_posts = Post.objects.filter(user=request.user, status='scheduled').count()

    all_posts = Post.objects.filter(user=request.user).only('hashtags')
    hashtags_list = []
    for post in all_posts:
        if post.hashtags:
            hashtags_list.extend(post.hashtags.split())

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
        'most_used_hashtags': most_used_hashtags
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_content(request):
    topic = request.data.get('topic', '').strip()
    platform = request.data.get('platform', 'instagram').lower()
    tone = request.data.get('tone', 'professional').lower()

    if not topic:
        return Response({'error': 'Topic is required'}, status=status.HTTP_400_BAD_REQUEST)
    if len(topic) > 500:
        return Response({'error': 'Topic must be 500 characters or fewer'}, status=status.HTTP_400_BAD_REQUEST)
    if platform not in VALID_PLATFORMS:
        return Response({'error': f'Platform must be one of: {", ".join(VALID_PLATFORMS)}'}, status=status.HTTP_400_BAD_REQUEST)
    if tone not in VALID_TONES:
        return Response({'error': f'Tone must be one of: {", ".join(VALID_TONES)}'}, status=status.HTTP_400_BAD_REQUEST)

    result = generate_all_content(topic, platform, tone)

    if result.get('error'):
        return Response(
            {'error': result['error']},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    result.pop('error', None)
    return Response(result, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def polish_content_view(request):
    caption = request.data.get('caption', '')
    hashtags = request.data.get('hashtags', '')
    image_prompt = request.data.get('image_prompt', '')
    topic = request.data.get('topic', '')
    platform = request.data.get('platform', 'instagram').lower()
    tone = request.data.get('tone', 'professional').lower()

    if not caption.strip():
        return Response({'error': 'Caption is required'}, status=status.HTTP_400_BAD_REQUEST)
    if platform not in VALID_PLATFORMS:
        return Response({'error': f'Platform must be one of: {", ".join(VALID_PLATFORMS)}'}, status=status.HTTP_400_BAD_REQUEST)
    if tone not in VALID_TONES:
        return Response({'error': f'Tone must be one of: {", ".join(VALID_TONES)}'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = polish_content(caption, hashtags, platform, tone, image_prompt, topic)
        return Response(result, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error('Polish content failed: %s', e, exc_info=True)
        return Response({'error': 'Content polishing failed. Please try again later.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_image(request):
    prompt = request.data.get('prompt', '').strip()
    platform = request.data.get('platform', 'instagram').lower()
    if not prompt:
        return Response({'error': 'Prompt is required'}, status=status.HTTP_400_BAD_REQUEST)
    if len(prompt) > 500:
        return Response({'error': 'Prompt must be 500 characters or fewer'}, status=status.HTTP_400_BAD_REQUEST)

    access_key = os.getenv('UNSPLASH_ACCESS_KEY')
    if not access_key:
        return Response({'error': 'Image service is not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    orientation = 'squarish' if platform == 'instagram' else 'landscape'
    query = ' '.join(prompt.split()[:3])
    url = f"https://api.unsplash.com/photos/random?query={http_requests.utils.quote(query)}&orientation={orientation}"
    headers = {'Authorization': f'Client-ID {access_key}'}

    try:
        resp = http_requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            return Response({'image_url': data['urls']['regular']})
        return Response({'error': 'No image found'}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as e:
        logger.error('Unsplash image fetch failed: %s', e, exc_info=True)
        return Response({'error': 'Image service unavailable. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)
