from django.urls import path
from . import views

urlpatterns = [
    # Authentication endpoints
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),  # Changed from login to login_view
    path('logout/', views.logout_view, name='logout'),  # Changed from logout to logout_view
    
    # Post endpoints
    path('posts/', views.posts_list, name='posts-list'),
    path('posts/<int:pk>/', views.post_detail, name='post-detail'),
    
    # Calendar endpoints
    path('calendar/', views.calendar_view, name='calendar'),
    path('calendar/today/', views.today_posts, name='today-posts'),
    
    # Dashboard endpoint
    path('dashboard/stats/', views.dashboard_stats, name='dashboard-stats'),

    path('generate-content/', views.generate_content, name='generate-content'),
]