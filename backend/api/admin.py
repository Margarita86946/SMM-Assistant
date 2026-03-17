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
