from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import Post, User
from .serializers import PostSerializer, UserSerializer
from django.db.models import Q, Count
from datetime import datetime, timedelta
from django.utils import timezone

# ========== AUTHENTICATION VIEWS ==========

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user"""
    serializer = UserSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.save()
        user.set_password(request.data.get('password'))
        user.save()
        
        # Create token for the new user
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'token': token.key,
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """Login user with improved error messages"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    # Check if username exists
    try:
        user_exists = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response(
            {'error': 'Username does not exist'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Authenticate user
    user = authenticate(username=username, password=password)
    
    if user is None:
        return Response(
            {'error': 'Incorrect password'}, 
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Get or create token
    token, created = Token.objects.get_or_create(user=user)
    
    return Response({
        'token': token.key,
        'user_id': user.id,
        'username': user.username,
        'email': user.email
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """Logout user by deleting their token"""
    try:
        request.user.auth_token.delete()
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ========== POST VIEWS ==========

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def posts_list(request):
    """Get all posts for logged-in user OR create a new post"""
    
    if request.method == 'GET':
        # Get all posts for the logged-in user
        posts = Post.objects.filter(user=request.user).order_by('-created_at')
        serializer = PostSerializer(posts, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        # Create a new post for the logged-in user
        serializer = PostSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def post_detail(request, pk):
    """Get, update, or delete a specific post"""
    
    try:
        # Make sure the post belongs to the logged-in user
        post = Post.objects.get(pk=pk, user=request.user)
    except Post.DoesNotExist:
        return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = PostSerializer(post)
        return Response(serializer.data)
    
    elif request.method == 'PUT':
        serializer = PostSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        post.delete()
        return Response({'message': 'Post deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


# ========== CALENDAR VIEWS ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calendar_view(request):
    """Get posts for a specific month"""
    month = request.GET.get('month')
    year = request.GET.get('year')
    
    if not month or not year:
        return Response({'error': 'Month and year are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Filter posts by month and year
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
    """Get posts scheduled for today"""
    today = timezone.now().date()
    
    posts = Post.objects.filter(
        user=request.user,
        scheduled_time__date=today
    ).order_by('scheduled_time')
    
    serializer = PostSerializer(posts, many=True)
    return Response(serializer.data)


# ========== DASHBOARD VIEWS ==========

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Get dashboard statistics for the logged-in user"""
    
    # Get total posts
    total_posts = Post.objects.filter(user=request.user).count()
    
    # Get posts from this week
    week_ago = timezone.now() - timedelta(days=7)
    posts_this_week = Post.objects.filter(
        user=request.user,
        created_at__gte=week_ago
    ).count()
    
    # Get draft posts
    draft_posts = Post.objects.filter(
        user=request.user,
        status='draft'
    ).count()
    
    # Get scheduled posts
    scheduled_posts = Post.objects.filter(
        user=request.user,
        status='scheduled'
    ).count()
    
    # Get most used hashtags (simple version)
    all_posts = Post.objects.filter(user=request.user)
    hashtags_list = []
    for post in all_posts:
        if post.hashtags:
            tags = post.hashtags.split()
            hashtags_list.extend(tags)
    
    # Count hashtag frequency
    from collections import Counter
    hashtag_counts = Counter(hashtags_list)
    most_used_hashtags = [{'tag': tag, 'count': count} for tag, count in hashtag_counts.most_common(5)]
    
    return Response({
        'total_posts': total_posts,
        'posts_this_week': posts_this_week,
        'draft_posts': draft_posts,
        'scheduled_posts': scheduled_posts,
        'most_used_hashtags': most_used_hashtags
    })