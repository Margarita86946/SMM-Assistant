from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from rest_framework.authtoken.models import Token

ROLE_CHOICES = [
    ('specialist', 'Specialist'),
    ('client', 'Client'),
]


class User(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.TextField(blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='specialist')

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


class EncryptionKey(models.Model):
    key_identifier = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    retired_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'encryption_keys'
        ordering = ['-created_at']

    def __str__(self):
        return f"EncryptionKey({self.key_identifier}, active={self.is_active})"

    @classmethod
    def get_active(cls):
        from django.db import transaction
        key = cls.objects.filter(is_active=True).order_by('-created_at').first()
        if key is not None:
            return key
        # No active key exists — create one. Use get_or_create with a fixed
        # sentinel identifier so concurrent calls converge on the same row
        # instead of each creating their own key.
        with transaction.atomic():
            key, _ = cls.objects.get_or_create(
                key_identifier='key_v1_default',
                defaults={'is_active': True},
            )
            if not key.is_active:
                key.is_active = True
                key.retired_at = None
                key.save(update_fields=['is_active', 'retired_at'])
        return key


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
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
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
    approval_note = models.TextField(blank=True)
    approved_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='approved_posts'
    )
    instagram_post_id = models.CharField(max_length=100, blank=True)
    auto_publish = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'posts'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.platform} - {self.status}"


class BrandProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='brand_profile')
    brand_name = models.CharField(max_length=255, blank=True)
    voice_tone = models.CharField(max_length=255, blank=True)
    target_audience = models.CharField(max_length=255, blank=True)
    keywords = models.TextField(blank=True)
    banned_words = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'brand_profiles'

    def __str__(self):
        return f"{self.user.username} brand profile"

    def to_context_string(self):
        parts = []
        if self.brand_name:
            parts.append(f"Brand: {self.brand_name}")
        if self.voice_tone:
            parts.append(f"Voice: {self.voice_tone}")
        if self.target_audience:
            parts.append(f"Audience: {self.target_audience}")
        if self.keywords:
            parts.append(f"Use keywords: {self.keywords}")
        if self.banned_words:
            parts.append(f"Never use: {self.banned_words}")
        return ", ".join(parts) if parts else None


class SocialAccount(models.Model):
    PLATFORM_CHOICES = [
        ('instagram', 'Instagram'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_accounts')
    owned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='managed_accounts',
    )
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    instagram_user_id = models.CharField(max_length=100)
    account_username = models.CharField(max_length=100)
    account_type = models.CharField(max_length=20, blank=True, default='')
    access_token = models.TextField(blank=True, default='')
    token_expires_at = models.DateTimeField(null=True, blank=True)
    token_last_refreshed = models.DateTimeField(null=True, blank=True)
    encryption_key = models.ForeignKey(
        EncryptionKey, on_delete=models.PROTECT, null=True, blank=True,
        related_name='social_accounts',
    )
    is_active = models.BooleanField(default=True)
    is_client_account = models.BooleanField(default=False)
    client_email = models.TextField(blank=True, default='')
    connected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'social_accounts'
        unique_together = ('user', 'platform', 'instagram_user_id')

    def __str__(self):
        return f"{self.user.username} - {self.platform} - {self.account_username}"

    @property
    def decrypted_token(self):
        from .encryption import decrypt
        if not self.access_token:
            return None
        return decrypt(self.access_token)

    @property
    def decrypted_client_email(self):
        from .encryption import decrypt
        if not self.client_email:
            return ''
        return decrypt(self.client_email) or ''


class ClientInvitation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked'),
    ]

    specialist = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='sent_invitations'
    )
    client_email = models.TextField()
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    invited_ip = models.GenericIPAddressField(null=True, blank=True)
    accepted_ip = models.GenericIPAddressField(null=True, blank=True)
    social_account = models.ForeignKey(
        SocialAccount, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invitations',
    )

    class Meta:
        db_table = 'client_invitations'
        ordering = ['-created_at']

    def __str__(self):
        return f"Invitation from {self.specialist.username} ({self.status})"

    @property
    def decrypted_client_email(self):
        from .encryption import decrypt
        if not self.client_email:
            return ''
        return decrypt(self.client_email) or ''

    @property
    def is_expired(self):
        return self.expires_at is not None and self.expires_at < timezone.now()

    @classmethod
    def find_by_token(cls, raw_token):
        from .encryption import hash_token
        if not raw_token:
            return None
        token_hash = hash_token(raw_token)
        return (
            cls.objects
            .filter(token_hash=token_hash, status='pending')
            .select_related('specialist')
            .first()
        )


class OAuthState(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, null=True, blank=True,
        related_name='oauth_states',
    )
    invitation = models.ForeignKey(
        ClientInvitation, on_delete=models.CASCADE, null=True, blank=True,
        related_name='oauth_states',
    )
    platform = models.CharField(max_length=20)
    nonce = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'oauth_states'

    def __str__(self):
        who = self.user.username if self.user_id else f'invite#{self.invitation_id}'
        return f"{who} - {self.platform} - expires {self.expires_at}"


class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('account_connected', 'Instagram Account Connected'),
        ('account_disconnected', 'Instagram Account Disconnected'),
        ('invitation_sent', 'Client Invitation Sent'),
        ('invitation_accepted', 'Client Invitation Accepted'),
        ('invitation_revoked', 'Client Invitation Revoked'),
        ('post_published', 'Post Published to Instagram'),
        ('post_publish_failed', 'Post Publish Failed'),
        ('token_refreshed', 'Access Token Refreshed'),
        ('token_expired', 'Access Token Expired'),
        ('login', 'User Login'),
        ('logout', 'User Logout'),
        ('password_changed', 'Password Changed'),
        ('credentials_updated', 'Credentials Updated'),
    ]

    workspace_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs',
    )
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    target_type = models.CharField(max_length=50, blank=True, default='')
    target_id = models.IntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['workspace_user', 'created_at']),
            models.Index(fields=['action', 'created_at']),
        ]

    def __str__(self):
        return f"{self.action} by {self.workspace_user_id} at {self.created_at}"


class EmailConfiguration(models.Model):
    PROVIDER_CHOICES = [
        ('gmail', 'Gmail SMTP'),
        ('sendgrid', 'SendGrid'),
        ('mailgun', 'Mailgun'),
        ('custom', 'Custom SMTP'),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='email_config'
    )
    provider = models.CharField(
        max_length=20, choices=PROVIDER_CHOICES, default='gmail'
    )
    smtp_host = models.CharField(max_length=100, default='smtp.gmail.com')
    smtp_port = models.IntegerField(default=587)
    smtp_user = models.EmailField()
    smtp_password_encrypted = models.TextField()
    encryption_key = models.ForeignKey(
        EncryptionKey, on_delete=models.PROTECT, null=True, blank=True,
        related_name='email_configurations',
    )
    from_name = models.CharField(max_length=100)
    from_email = models.EmailField()
    is_verified = models.BooleanField(default=False)
    last_test_sent = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'email_configurations'

    def __str__(self):
        return f"EmailConfig({self.user.username}, {self.provider})"

    @property
    def decrypted_smtp_password(self):
        from .encryption import decrypt
        if not self.smtp_password_encrypted:
            return ''
        return decrypt(self.smtp_password_encrypted) or ''
