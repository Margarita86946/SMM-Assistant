from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Post, BrandProfile, SocialAccount, OAuthState

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'role', 'is_staff', 'date_joined']
    list_filter = ['role', 'is_staff', 'is_superuser', 'date_joined']
    fieldsets = UserAdmin.fieldsets + (
        ('Extra', {'fields': ('role', 'avatar')}),
    )

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'platform', 'status', 'scheduled_time', 'created_at']
    list_filter = ['platform', 'status', 'created_at']
    search_fields = ['caption', 'hashtags', 'image_prompt']
    date_hierarchy = 'created_at'

@admin.register(BrandProfile)
class BrandProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'brand_name', 'updated_at']
    search_fields = ['user__username', 'brand_name']


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'platform', 'account_username', 'account_type', 'is_active', 'token_expires_at', 'connected_at']
    list_filter = ['platform', 'is_active', 'account_type']
    search_fields = ['user__username', 'account_username', 'instagram_user_id']
    readonly_fields = ['connected_at']


@admin.register(OAuthState)
class OAuthStateAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'platform', 'expires_at', 'created_at']
    list_filter = ['platform']
    search_fields = ['user__username', 'nonce']
    readonly_fields = ['created_at']
