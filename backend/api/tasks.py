import logging
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from api import instagram_service
from api.audit import log_action
from api.encryption import encrypt, get_active_key_id
from api.models import AuditLog, EncryptionKey, Notification, Post, SocialAccount
from api.notify import notify_post_publish_failed, notify_post_published, notify_post_reminder

logger = logging.getLogger('api')


@shared_task(bind=True, max_retries=3, default_retry_delay=60, ignore_result=True)
def publish_scheduled(self):
    now = timezone.now()
    due = Post.objects.filter(
        status='scheduled',
        platform='instagram',
        scheduled_time__lte=now,
        deleted_at__isnull=True,
    ).select_related('user', 'client', 'social_account')

    published = 0
    for post in due:
        try:
            _publish_post(post, now)
            published += 1
        except Exception as e:
            logger.error('publish_scheduled: unexpected error on post %s: %s', post.pk, e, exc_info=True)

    if published:
        logger.info('publish_scheduled: published %d post(s)', published)


def _publish_post(post, now):
    with transaction.atomic():
        try:
            locked = Post.objects.select_for_update().get(pk=post.pk, status='scheduled')
        except Post.DoesNotExist:
            return

        account = _resolve_account(locked, now)
        if account is None:
            return

        caption_text = locked.caption or ''
        if locked.hashtags:
            caption_text = f'{caption_text}\n\n{locked.hashtags}'.strip()

        is_video = locked.media_type == 'video'
        media_url = locked.video_url if is_video else locked.image_url
        if not media_url or media_url.startswith('data:'):
            logger.warning('publish_scheduled: post %s — media not publishable', locked.pk)
            return

        try:
            decrypted_token = account.decrypted_token
        except Exception as e:
            logger.error('publish_scheduled: post %s — token decryption failed: %s', locked.pk, e)
            return

        if not decrypted_token:
            logger.warning('publish_scheduled: post %s — empty token', locked.pk)
            _notify_expired(locked, account)
            return

        if account.token_expires_at and account.token_expires_at <= now:
            logger.warning('publish_scheduled: post %s — token expired', locked.pk)
            _notify_expired(locked, account)
            return

        if account.token_expires_at is None:
            logger.warning('publish_scheduled: post %s — token_expires_at unknown, attempting publish anyway', locked.pk)

        try:
            if is_video:
                ig_post_id = instagram_service.publish_reel(
                    decrypted_token, account.instagram_user_id, media_url, caption_text,
                )
            else:
                ig_post_id = instagram_service.publish_image_post(
                    decrypted_token, account.instagram_user_id, media_url, caption_text,
                )
        except instagram_service.InstagramAPIError as e:
            logger.error('publish_scheduled: post %s failed: %s', locked.pk, e)
            notify_post_publish_failed(locked)
            log_action(locked.user, 'post_publish_failed', target=locked, metadata={'error': str(e)[:200], 'source': 'scheduler'})
            return

        locked.status = 'posted'
        locked.instagram_post_id = ig_post_id
        locked.save(update_fields=['status', 'instagram_post_id', 'updated_at'])

    notify_post_published(post)
    log_action(post.user, 'post_published', target=post, metadata={'instagram_post_id': ig_post_id, 'source': 'scheduler'})
    logger.info('publish_scheduled: published post %s → %s', post.pk, ig_post_id)


def _resolve_account(post, now):
    account_owner = post.client if post.client_id else post.user

    if post.social_account_id:
        try:
            return SocialAccount.objects.get(
                pk=post.social_account_id, account_user=account_owner, is_active=True
            )
        except SocialAccount.DoesNotExist:
            logger.warning('publish_scheduled: post %s — assigned IG account not found/inactive', post.pk)
            return None

    try:
        return SocialAccount.objects.get(
            account_user=account_owner, platform='instagram', is_active=True
        )
    except SocialAccount.DoesNotExist:
        logger.warning(
            'publish_scheduled: post %s — no Instagram account for user %s',
            post.pk, account_owner.username,
        )
        return None
    except SocialAccount.MultipleObjectsReturned:
        return (
            SocialAccount.objects
            .filter(account_user=account_owner, platform='instagram', is_active=True)
            .order_by('-token_last_refreshed')
            .first()
        )


def _notify_expired(post, account):
    notify_post_publish_failed(post)
    logger.warning(
        'publish_scheduled: post %s skipped — token missing/expired for account %s',
        post.pk, account.pk,
    )


@shared_task(ignore_result=True)
def remind_scheduled(minutes=60):
    now = timezone.now()
    window_end = now + timedelta(minutes=minutes)

    due_posts = Post.objects.filter(
        status='scheduled',
        scheduled_time__gte=now,
        scheduled_time__lte=window_end,
        deleted_at__isnull=True,
    ).select_related('user', 'client')

    due_post_ids = [p.pk for p in due_posts]

    already_reminded_ids = set(
        Notification.objects.filter(
            post_id__in=due_post_ids,
            notification_type='post_scheduled_reminder',
        ).values_list('post_id', flat=True)
    )

    sent = 0
    for post in due_posts:
        if post.pk in already_reminded_ids:
            continue
        notify_post_reminder(post)
        sent += 1

    if sent:
        logger.info('remind_scheduled: sent %d reminder(s)', sent)


@shared_task(ignore_result=True)
def refresh_instagram_tokens(days=7):
    threshold = timezone.now() + timedelta(days=days)
    accounts = SocialAccount.objects.filter(
        platform='instagram',
        is_active=True,
        token_expires_at__isnull=False,
        token_expires_at__lte=threshold,
    ).only(
        'id', 'access_token', 'account_username', 'instagram_user_id',
        'token_expires_at', 'token_last_refreshed', 'encryption_key_id',
    )

    total = accounts.count()
    if total == 0:
        return

    refreshed = 0
    failed = 0
    for account in accounts:
        try:
            decrypted_token = account.decrypted_token
        except Exception as e:
            logger.error('refresh_instagram_tokens: account %s decryption failed: %s', account.pk, e)
            failed += 1
            continue

        if not decrypted_token:
            logger.warning('refresh_instagram_tokens: account %s has no token, skipping', account.pk)
            continue

        try:
            result = instagram_service.refresh_long_lived_token(decrypted_token)
        except instagram_service.InstagramAPIError as e:
            logger.error('refresh_instagram_tokens: account %s failed: %s', account.pk, e)
            failed += 1
            continue

        active_key_id = get_active_key_id()
        account.access_token = encrypt(result['access_token'], key_id=active_key_id)
        account.encryption_key = EncryptionKey.objects.get(pk=active_key_id)
        account.token_expires_at = timezone.now() + timedelta(seconds=result.get('expires_in', 5184000))
        account.token_last_refreshed = timezone.now()
        account.save(update_fields=['access_token', 'encryption_key_id', 'token_expires_at', 'token_last_refreshed'])
        log_action(account.account_user, 'token_refreshed', target=account, metadata={'platform': 'instagram'})
        refreshed += 1

    logger.info('refresh_instagram_tokens: refreshed=%d failed=%d', refreshed, failed)


@shared_task(ignore_result=True)
def cleanup_audit_logs(days=90):
    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = AuditLog.objects.filter(created_at__lt=cutoff).delete()
    if deleted:
        logger.info('cleanup_audit_logs: deleted %d records older than %d days', deleted, days)
