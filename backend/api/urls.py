from django.urls import path
from . import views

urlpatterns = [
    path('auth/register/', views.register, name='register'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    
    path('posts/', views.posts_list, name='posts-list'),
    path('posts/<int:pk>/', views.post_detail, name='post-detail'),
    path('posts/status/<str:status_type>/', views.posts_by_status, name='posts-by-status'),
    path('posts/platform/<str:platform>/', views.posts_by_platform, name='posts-by-platform'),
    
    path('dashboard/stats/', views.dashboard_stats, name='dashboard-stats'),
]