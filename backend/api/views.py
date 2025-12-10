from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from .models import User, Post, ImagePrompt
from .serializers import (
    UserSerializer,
    PostSerializer,
    PostCreateSerializer,
    ImagePromptSerializer
)

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """Register a new user"""
    serializer = UserSerializer(data=request.data)
    
    if serializer.is_valid():
        user = serializer.save()
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'message': 'User created successfully',
            'user': UserSerializer(user).data,
            'token': token.key
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Login user and return token"""
    username = request.data.get('username')
    password = request.data.get('password')
    
    if not username or not password:
        return Response({
            'error': 'Please provide both username and password'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    user = authenticate(username=username, password=password)
    
    if user:
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'message': 'Login successful',
            'token': token.key,
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
    
    return Response({
        'error': 'Invalid credentials'
    }, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """Logout user by deleting token"""
    try:
        request.user.auth_token.delete()
        return Response({
            'message': 'Logout successful'
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def posts_list(request):
    """
    GET: List all posts for authenticated user
    POST: Create new post
    """
    if request.method == 'GET':
        posts = Post.objects.filter(user=request.user).order_by('-created_at')
        serializer = PostSerializer(posts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        serializer = PostCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            post = serializer.save(user=request.user)
            
            return Response(
                PostSerializer(post).data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def post_detail(request, pk):
    """
    GET: Retrieve specific post
    PUT: Update specific post
    DELETE: Delete specific post
    """
    try:
        post = Post.objects.get(pk=pk, user=request.user)
    except Post.DoesNotExist:
        return Response({
            'error': 'Post not found'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if request.method == 'GET':
        serializer = PostSerializer(post)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    elif request.method == 'PUT':
        serializer = PostSerializer(post, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    elif request.method == 'DELETE':
        post.delete()
        return Response({
            'message': 'Post deleted successfully'
        }, status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def posts_by_status(request, status_type):
    """Get posts filtered by status (draft/scheduled/posted)"""
    valid_statuses = ['draft', 'scheduled', 'ready_to_post', 'posted']
    
    if status_type not in valid_statuses:
        return Response({
            'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    posts = Post.objects.filter(
        user=request.user,
        status=status_type
    ).order_by('-created_at')
    
    serializer = PostSerializer(posts, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def posts_by_platform(request, platform):
    """Get posts filtered by platform (instagram/linkedin/twitter)"""
    valid_platforms = ['instagram', 'linkedin', 'twitter']
    
    if platform not in valid_platforms:
        return Response({
            'error': f'Invalid platform. Must be one of: {", ".join(valid_platforms)}'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    posts = Post.objects.filter(
        user=request.user,
        platform=platform
    ).order_by('-created_at')
    
    serializer = PostSerializer(posts, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Get statistics for dashboard"""
    user = request.user
    
    total_posts = Post.objects.filter(user=user).count()
    draft_posts = Post.objects.filter(user=user, status='draft').count()
    scheduled_posts = Post.objects.filter(user=user, status='scheduled').count()
    posted_posts = Post.objects.filter(user=user, status='posted').count()
    
    instagram_posts = Post.objects.filter(user=user, platform='instagram').count()
    linkedin_posts = Post.objects.filter(user=user, platform='linkedin').count()
    twitter_posts = Post.objects.filter(user=user, platform='twitter').count()
    
    return Response({
        'total_posts': total_posts,
        'draft_posts': draft_posts,
        'scheduled_posts': scheduled_posts,
        'posted_posts': posted_posts,
        'platforms': {
            'instagram': instagram_posts,
            'linkedin': linkedin_posts,
            'twitter': twitter_posts
        }
    }, status=status.HTTP_200_OK)