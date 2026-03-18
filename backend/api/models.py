from django.db import models
from django.contrib.auth.models import AbstractUser
from rest_framework.authtoken.models import Token

class User(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username


class TokenExpiry(models.Model):
    token = models.OneToOneField(Token, on_delete=models.CASCADE, related_name='expiry')
    expires_at = models.DateTimeField()
    is_revoked = models.BooleanField(default=False)

    class Meta:
        db_table = 'token_expiry'

    def __str__(self):
        return f"{self.token.user.username} - expires {self.expires_at}"


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
