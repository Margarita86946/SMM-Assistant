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

    path('profile/', views.profile_view, name='profile'),
    path('change-password/', views.change_password, name='change-password'),
]
