# SMM Assistant — Backend Snapshot

## Stack & Architecture
- Django 4.2.7 + Django REST Framework 3.14.0
- PostgreSQL via psycopg2
- Token authentication (rest_framework.authtoken)
- Groq AI (llama-3.3-70b-versatile) via api/ai_service.py
- Unsplash API for images via views.py
- No django-ratelimit (removed)
- Function-based views with @api_view + @permission_classes
- AUTH_USER_MODEL = 'api.User'

## API Endpoints (all under /api/)
- POST /register/
- POST /login/
- POST /logout/
- GET/POST /posts/  — paginated (page_size=50), returns {count, next, previous, results}
- GET/PUT/DELETE /posts/<pk>/
- GET /calendar/?month=&year=
- GET /calendar/today/
- GET /dashboard/stats/
- POST /generate-content/
- POST /polish-content/
- POST /generate-image/

## DB Models (current — all migrations 0001-0006 applied)
### User (table: users)
Fields: id, username, email (unique), password, date_joined (from AbstractUser)
Note: NO created_at — removed in migration 0006. Use date_joined instead.

### Post (table: posts)
Fields: id, user(FK→User CASCADE), caption(TextField), hashtags(TextField blank),
        topic(CharField 255 blank default=''), tone(CharField 50 blank default=''),
        image_prompt(TextField blank default=''), image_url(URLField 1000 blank default=''),
        platform(CharField 15 choices instagram/linkedin/twitter db_index),
        scheduled_time(DateTimeField null blank db_index),
        status(CharField 20 choices draft/scheduled/ready_to_post/posted db_index),
        created_at(auto_now_add), updated_at(auto_now)
Meta: db_table='posts', ordering=['-created_at']

## Serializers
### PostSerializer (READ — used for GET responses and PUT)
fields: id, username(read_only source=user.username), caption, hashtags, topic, tone,
        image_prompt, image_url, platform, scheduled_time, status, created_at, updated_at
read_only_fields: id, created_at, updated_at, username
Has: validate_platform(), validate_status(), validate() for scheduled_time check
Used for: GET /posts/, GET /posts/<pk>/, response after POST and PUT

### PostCreateSerializer (WRITE — used for POST /posts/)
fields: caption, hashtags, topic, tone, image_prompt, image_url, platform, scheduled_time, status
Has: validate() for scheduled_time check
Used for: POST /posts/ only

### UserSerializer
fields: id, username, email, password(write_only), date_joined(read_only)
Has: create() with validate_password() before set_password()

### Shared validator
validate_scheduled_status(status_value, scheduled_time) — raises ValidationError if status='scheduled' and no scheduled_time

---

## backend/api/models.py
```python
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    email = models.EmailField(unique=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username


class Post(models.Model):
    PLATFORM_CHOICES = [
        ('instagram', 'Instagram'),
        ('linkedin', 'LinkedIn'),
        ('twitter', 'Twitter'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('ready_to_post', 'Ready to Post'),
        ('posted', 'Posted'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    caption = models.TextField()
    hashtags = models.TextField(blank=True)
    topic = models.CharField(max_length=255, blank=True, default='')
    tone = models.CharField(max_length=50, blank=True, default='')
    image_prompt = models.TextField(blank=True, default='')
    image_url = models.URLField(max_length=1000, blank=True, default='')
    platform = models.CharField(max_length=15, choices=PLATFORM_CHOICES, default='instagram', db_index=True)
    scheduled_time = models.DateTimeField(null=True, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'posts'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.platform} - {self.status}"
```

---

## backend/api/serializers.py
```python
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User, Post


def validate_scheduled_status(status_value, scheduled_time):
    if status_value == 'scheduled' and not scheduled_time:
        raise serializers.ValidationError({
            'scheduled_time': 'A scheduled time is required when status is "scheduled".'
        })


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'date_joined']
        read_only_fields = ['id', 'date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            try:
                validate_password(password, user)
            except DjangoValidationError as e:
                raise serializers.ValidationError({'password': list(e.messages)})
            user.set_password(password)
        user.save()
        return user


class PostSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'username', 'caption', 'hashtags', 'topic', 'tone',
            'image_prompt', 'image_url', 'platform', 'scheduled_time', 'status',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'username']

    def validate_platform(self, value):
        valid_platforms = ['instagram', 'linkedin', 'twitter']
        if value.lower() not in valid_platforms:
            raise serializers.ValidationError(
                f"Platform must be one of: {', '.join(valid_platforms)}"
            )
        return value.lower()

    def validate_status(self, value):
        valid_statuses = ['draft', 'scheduled', 'ready_to_post', 'posted']
        if value.lower() not in valid_statuses:
            raise serializers.ValidationError(
                f"Status must be one of: {', '.join(valid_statuses)}"
            )
        return value.lower()

    def validate(self, data):
        status_value = data.get('status', getattr(self.instance, 'status', None))
        scheduled_time = data.get('scheduled_time', getattr(self.instance, 'scheduled_time', None))
        validate_scheduled_status(status_value, scheduled_time)
        return data


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = [
            'caption',
            'hashtags',
            'topic',
            'tone',
            'image_prompt',
            'image_url',
            'platform',
            'scheduled_time',
            'status',
        ]

    def validate(self, data):
        validate_scheduled_status(data.get('status', 'draft'), data.get('scheduled_time'))
        return data
```

---

## backend/api/views.py
```python
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
from rest_framework.authtoken.models import Token
from .models import Post, User
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
    username = request.data.get('username')
    password = request.data.get('password')
    try:
        User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
    user = authenticate(username=username, password=password)
    if user is None:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
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
    try:
        request.user.auth_token.delete()
        return Response({'message': 'Successfully logged out'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def posts_list(request):
    if request.method == 'GET':
        posts = Post.objects.filter(user=request.user).order_by('-created_at')
        paginator = PageNumberPagination()
        paginator.page_size = 50
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
        return Response(PostSerializer(post).data)
    elif request.method == 'PUT':
        serializer = PostSerializer(post, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    elif request.method == 'DELETE':
        post.delete()
        return Response({'message': 'Post deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


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
    return Response(PostSerializer(posts, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def today_posts(request):
    today = timezone.now().date()
    posts = Post.objects.filter(user=request.user, scheduled_time__date=today).order_by('scheduled_time')
    return Response(PostSerializer(posts, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    total_posts = Post.objects.filter(user=request.user).count()
    week_ago = timezone.now() - timedelta(days=7)
    posts_this_week = Post.objects.filter(user=request.user, created_at__gte=week_ago).count()
    draft_posts = Post.objects.filter(user=request.user, status='draft').count()
    scheduled_posts = Post.objects.filter(user=request.user, status='scheduled').count()
    all_posts = Post.objects.filter(user=request.user)
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
        return Response({'error': result['error']}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return Response(result, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def polish_content_view(request):
    caption = request.data.get('caption', '')
    hashtags = request.data.get('hashtags', '')
    image_prompt = request.data.get('image_prompt', '')
    platform = request.data.get('platform', 'instagram')
    tone = request.data.get('tone', 'professional')
    if not caption.strip():
        return Response({'error': 'Caption is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        result = polish_content(caption, hashtags, platform, tone, image_prompt)
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
```

---

## backend/api/ai_service.py
```python
import os
import logging
from groq import Groq
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

GROQ_API_KEY = os.getenv('GROQ_API_KEY')
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in your .env file")

client = Groq(api_key=GROQ_API_KEY)

def generate_caption(topic, platform, tone):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""Write a social media caption for {platform}.
Topic: {topic}
Tone: {tone}
Rules:
- Make it engaging and natural
- Suitable length for {platform}
- Do NOT include hashtags
- Return ONLY the caption text, nothing else"""}]
    )
    return response.choices[0].message.content.strip()


def generate_hashtags(topic, platform):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""Generate hashtags for a {platform} post about: {topic}
Rules:
- Return ONLY hashtags, nothing else
- Each hashtag starts with #
- Separate with spaces
- Instagram: 10-15 hashtags
- LinkedIn/Twitter: 3-5 hashtags"""}]
    )
    return response.choices[0].message.content.strip()


def generate_image_prompt(topic, caption):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""Create a detailed image generation prompt for this social media post.
Topic: {topic}
Caption: {caption}
Rules:
- Describe the image visually and specifically
- Include style, lighting, mood
- Return ONLY the image prompt, nothing else"""}]
    )
    return response.choices[0].message.content.strip()


def polish_content(caption, hashtags, platform, tone='professional', image_prompt=''):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": f"""Polish this social media post content for {platform} in a {tone} tone.

Caption: {caption}
Current hashtags: {hashtags}
Current image prompt: {image_prompt if image_prompt else 'none'}

Rules for caption:
- Fix grammar and improve quality
- Make it suitable length for {platform}
- Keep the original message and intent
- Do NOT include hashtags in the caption

Rules for hashtags:
- Generate relevant hashtags based on the caption
- Instagram: 10-15 hashtags
- LinkedIn/Twitter: 3-5 hashtags
- Each starts with #, separated by spaces

Rules for image prompt:
- Improve or generate a vivid image prompt based on the caption
- Include style, lighting, mood, and composition details
- Return ONLY the prompt text, no labels

Return ONLY in this exact format (no extra text):
CAPTION: [polished caption here]
HASHTAGS: [hashtags here]
IMAGE_PROMPT: [image prompt here]"""}]
    )
    text = response.choices[0].message.content.strip()
    caption_result = caption
    hashtags_result = hashtags
    image_prompt_result = image_prompt
    if 'CAPTION:' in text and 'HASHTAGS:' in text:
        cap_start = text.index('CAPTION:') + len('CAPTION:')
        hash_start = text.index('HASHTAGS:')
        caption_result = text[cap_start:hash_start].strip()
        if 'IMAGE_PROMPT:' in text:
            img_start = text.index('IMAGE_PROMPT:')
            hashtags_result = text[hash_start + len('HASHTAGS:'):img_start].strip()
            image_prompt_result = text[img_start + len('IMAGE_PROMPT:'):].strip()
        else:
            hashtags_result = text[hash_start + len('HASHTAGS:'):].strip()
    return {'caption': caption_result, 'hashtags': hashtags_result, 'image_prompt': image_prompt_result}


def generate_all_content(topic, platform, tone):
    try:
        caption = generate_caption(topic, platform, tone)
        hashtags = generate_hashtags(topic, platform)
        image_prompt = generate_image_prompt(topic, caption)
        return {'caption': caption, 'hashtags': hashtags, 'image_prompt': image_prompt, 'error': None}
    except Exception as e:
        logger.error('AI content generation failed: %s', e, exc_info=True)
        return {'caption': '', 'hashtags': '', 'image_prompt': '', 'error': 'AI generation failed. Please try again later.'}
```

---

## backend/api/admin.py
```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Post

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'is_staff', 'date_joined']
    list_filter = ['is_staff', 'is_superuser', 'date_joined']

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'platform', 'status', 'scheduled_time', 'created_at']
    list_filter = ['platform', 'status', 'created_at']
    search_fields = ['caption', 'hashtags', 'image_prompt']
    date_hierarchy = 'created_at'
```

---

## backend/api/urls.py
```python
from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('posts/', views.posts_list, name='posts-list'),
    path('posts/<int:pk>/', views.post_detail, name='post-detail'),
    path('calendar/', views.calendar_view, name='calendar'),
    path('calendar/today/', views.today_posts, name='today-posts'),
    path('dashboard/stats/', views.dashboard_stats, name='dashboard-stats'),
    path('generate-content/', views.generate_content, name='generate-content'),
    path('polish-content/', views.polish_content_view, name='polish-content'),
    path('generate-image/', views.generate_image, name='generate-image'),
]
```

---

## backend/smm_assistant/urls.py
```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
```

---

## backend/smm_assistant/settings.py
```python
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set in your .env file")

DB_PASSWORD = os.getenv('DATABASE_PASSWORD')
if not DB_PASSWORD:
    raise ValueError("DATABASE_PASSWORD is not set in your .env file")

DEBUG = os.getenv('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'smm_assistant.urls'

TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
    'OPTIONS': {'context_processors': ['django.template.context_processors.debug',
        'django.template.context_processors.request', 'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages']}}]

WSGI_APPLICATION = 'smm_assistant.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DATABASE_NAME', 'smm_assistant_db'),
        'USER': os.getenv('DATABASE_USER', 'smm_user'),
        'PASSWORD': DB_PASSWORD,
        'HOST': os.getenv('DATABASE_HOST', 'localhost'),
        'PORT': os.getenv('DATABASE_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

_cors_env = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_env.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

LOGGING = {
    'version': 1, 'disable_existing_loggers': False,
    'formatters': {'verbose': {'format': '[{asctime}] {levelname} {name}: {message}', 'style': '{'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'}},
    'root': {'handlers': ['console'], 'level': 'WARNING'},
    'loggers': {'api': {'handlers': ['console'], 'level': 'DEBUG' if DEBUG else 'INFO', 'propagate': False}},
}

AUTH_USER_MODEL = 'api.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.TokenAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
}
```

---

## backend/requirements.txt
```
Django==4.2.7
djangorestframework==3.14.0
django-cors-headers==4.3.1
python-dotenv==1.0.0
psycopg2==2.9.11
groq==1.0.0
requests==2.31.0
asgiref==3.7.2
sqlparse==0.4.4
certifi>=2024.2.2
charset-normalizer==3.3.2
idna==3.6
urllib3==2.2.1
httpx>=0.27.0
pydantic>=2.6.0
anyio>=4.3.0
```

---

## backend/api/tests.py
```python
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from .models import User, Post


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')

    def test_register_success(self):
        res = self.client.post(self.register_url, {'username': 'testuser', 'email': 'test@example.com', 'password': 'StrongPass123!'})
        self.assertEqual(res.status_code, 201)
        self.assertIn('token', res.data)

    def test_register_duplicate_username(self):
        User.objects.create_user(username='testuser', email='a@a.com', password='pass')
        res = self.client.post(self.register_url, {'username': 'testuser', 'email': 'b@b.com', 'password': 'StrongPass123!'})
        self.assertEqual(res.status_code, 400)

    def test_register_duplicate_email(self):
        User.objects.create_user(username='user1', email='same@example.com', password='pass')
        res = self.client.post(self.register_url, {'username': 'user2', 'email': 'same@example.com', 'password': 'StrongPass123!'})
        self.assertEqual(res.status_code, 400)

    def test_login_success(self):
        User.objects.create_user(username='testuser', email='t@t.com', password='StrongPass123!')
        res = self.client.post(self.login_url, {'username': 'testuser', 'password': 'StrongPass123!'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)

    def test_login_wrong_password(self):
        User.objects.create_user(username='testuser', email='t@t.com', password='StrongPass123!')
        res = self.client.post(self.login_url, {'username': 'testuser', 'password': 'wrongpassword'})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data['error'], 'Invalid credentials')

    def test_login_unknown_user_returns_401(self):
        res = self.client.post(self.login_url, {'username': 'nobody', 'password': 'anything'})
        self.assertEqual(res.status_code, 401)


class PostTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='t@t.com', password='StrongPass123!')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.posts_url = reverse('posts-list')

    def test_create_draft_post(self):
        res = self.client.post(self.posts_url, {'caption': 'Hello world', 'platform': 'instagram', 'status': 'draft'})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['caption'], 'Hello world')

    def test_list_posts_paginated(self):
        Post.objects.create(user=self.user, caption='Post 1', platform='instagram', status='draft')
        Post.objects.create(user=self.user, caption='Post 2', platform='linkedin', status='draft')
        res = self.client.get(self.posts_url)
        self.assertEqual(res.status_code, 200)
        self.assertIn('results', res.data)
        self.assertEqual(len(res.data['results']), 2)

    def test_list_posts_requires_auth(self):
        self.client.credentials()
        res = self.client.get(self.posts_url)
        self.assertEqual(res.status_code, 401)

    def test_scheduled_post_requires_time(self):
        res = self.client.post(self.posts_url, {'caption': 'Test', 'platform': 'instagram', 'status': 'scheduled'})
        self.assertEqual(res.status_code, 400)

    def test_delete_post(self):
        post = Post.objects.create(user=self.user, caption='To delete', platform='instagram', status='draft')
        res = self.client.delete(reverse('post-detail', args=[post.pk]))
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Post.objects.filter(pk=post.pk).exists())

    def test_cannot_access_other_users_post(self):
        other_user = User.objects.create_user(username='other', email='o@o.com', password='pass')
        post = Post.objects.create(user=other_user, caption='Private', platform='instagram', status='draft')
        res = self.client.get(reverse('post-detail', args=[post.pk]))
        self.assertEqual(res.status_code, 404)


class GenerateContentValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='u', email='u@u.com', password='pass')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.url = reverse('generate-content')

    def test_missing_topic_returns_400(self):
        res = self.client.post(self.url, {'platform': 'instagram', 'tone': 'professional'})
        self.assertEqual(res.status_code, 400)

    def test_topic_too_long_returns_400(self):
        res = self.client.post(self.url, {'topic': 'x' * 501, 'platform': 'instagram', 'tone': 'professional'})
        self.assertEqual(res.status_code, 400)

    def test_invalid_platform_returns_400(self):
        res = self.client.post(self.url, {'topic': 'test', 'platform': 'tiktok', 'tone': 'professional'})
        self.assertEqual(res.status_code, 400)

    def test_invalid_tone_returns_400(self):
        res = self.client.post(self.url, {'topic': 'test', 'platform': 'instagram', 'tone': 'aggressive'})
        self.assertEqual(res.status_code, 400)
```
