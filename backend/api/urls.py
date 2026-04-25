from django.urls import path
from . import views

urlpatterns = [
    # Authentication
    path('register/', views.register, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
    path('change-password/', views.change_password, name='change-password'),

    # Posts
    path('posts/', views.posts_list, name='posts-list'),
    path('posts/<int:pk>/', views.post_detail, name='post-detail'),
    path('posts/upload-image/', views.upload_post_image, name='upload-post-image'),
    path('posts/upload-video/', views.upload_post_video, name='upload-post-video'),
    path('posts/<int:pk>/submit/', views.submit_post, name='submit-post'),
    path('posts/<int:pk>/approve/', views.approve_post, name='approve-post'),
    path('posts/<int:pk>/reject/', views.reject_post, name='reject-post'),
    path('posts/<int:pk>/publish-now/', views.publish_post_now, name='publish-post-now'),

    # Calendar
    path('calendar/', views.calendar_view, name='calendar'),
    path('calendar/today/', views.today_posts, name='today-posts'),

    # Dashboard
    path('dashboard/stats/', views.dashboard_stats, name='dashboard-stats'),
    path('dashboard/activity/', views.dashboard_activity, name='dashboard-activity'),

    # AI Content Generation
    path('generate-content/', views.generate_content, name='generate-content'),
    path('polish-content/', views.polish_content_view, name='polish-content'),
    path('generate-image/', views.generate_image, name='generate-image'),
    path('generate-variants/', views.generate_variants, name='generate-variants'),
    path('ai-status/', views.ai_status, name='ai-status'),

    # Brand Profile
    path('brand-profile/', views.brand_profile, name='brand-profile'),

    # Instagram Integration
    path('auth/instagram/', views.instagram_oauth_start, name='instagram-oauth-start'),
    path('auth/instagram/callback/', views.instagram_oauth_callback, name='instagram-oauth-callback'),
    path('auth/instagram/disconnect/<int:pk>/', views.instagram_disconnect, name='instagram-disconnect'),
    path('auth/instagram/status/', views.instagram_status, name='instagram-status'),

    # Client Invitations & Clients
    path('invitations/', views.invitations_list, name='invitations-list'),
    path('invitations/<int:pk>/', views.invitation_detail, name='invitation-detail'),
    path('invitations/lookup/<str:token>/', views.invitation_lookup, name='invitation-lookup'),
    path('clients/', views.clients_list, name='clients-list'),
    path('clients/<int:pk>/', views.client_detail, name='client-detail'),

    # Email Configuration
    path('email-config/', views.email_config_view, name='email-config'),

    # Audit Logs
    path('audit-logs/', views.audit_logs_view, name='audit-logs'),

    # Notifications
    path('notifications/', views.notifications_list, name='notifications-list'),
    path('notifications/<int:pk>/read/', views.mark_read, name='notification-read'),
    path('notifications/read-all/', views.mark_all_read, name='notifications-read-all'),

    # Analyzer
    path('analyzer/accounts/', views.analyzer_accounts, name='analyzer-accounts'),
    path('analyzer/<int:account_id>/overview/', views.analyzer_overview, name='analyzer-overview'),
    path('analyzer/<int:account_id>/posts/', views.analyzer_posts, name='analyzer-posts'),
    path('analyzer/<int:account_id>/audience/', views.analyzer_audience, name='analyzer-audience'),
    path('analyzer/<int:account_id>/ai/', views.analyzer_ai, name='analyzer-ai'),
    path('analyzer/<int:account_id>/refresh/', views.analyzer_refresh, name='analyzer-refresh'),
    path('analyzer/demo-toggle/', views.analyzer_demo_toggle, name='analyzer-demo-toggle'),
]