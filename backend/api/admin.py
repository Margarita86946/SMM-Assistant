from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Post, ImagePrompt

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'is_staff', 'created_at']
    list_filter = ['is_staff', 'is_superuser', 'created_at']

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'platform', 'status', 'scheduled_time', 'created_at']
    list_filter = ['platform', 'status', 'created_at']
    search_fields = ['caption', 'hashtags']
    date_hierarchy = 'created_at'

@admin.register(ImagePrompt)
class ImagePromptAdmin(admin.ModelAdmin):
    list_display = ['id', 'post', 'created_at']
    search_fields = ['prompt_text']