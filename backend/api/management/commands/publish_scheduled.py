import logging
import time

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api import instagram_service
from api.models import Post, SocialAccount
from api.notify import notify_post_published, notify_post_publish_failed

logger = logging.getLogger('api')

HEARTBEAT_SECONDS = 60
MAX_SLEEP_SECONDS = 300


def publish_due():
    now = timezone.now()
    due = Post.objects.filter(
        status='scheduled',
        platform='instagram',
        scheduled_time__lte=now,
        deleted_at__isnull=True,
        client__isnull=False,
    ).select_related('user', 'client', 'social_account')

    published = 0
    for post in due:
        if not post.client_id:
            logger.warning('publish_scheduled: post %s — no client assigned, skipping', post.pk)
            continue

        with transaction.atomic():
            try:
                locked = Post.objects.select_for_update().get(pk=post.pk, status='scheduled')
            except Post.DoesNotExist:
                continue

        if post.social_account_id:
            try:
                account = SocialAccount.objects.get(
                    pk=post.social_account_id, account_user=post.client, is_active=True
                )
            except SocialAccount.DoesNotExist:
                logger.warning('publish_scheduled: post %s — assigned IG account not found/inactive', post.pk)
                continue
        else:
            try:
                account = SocialAccount.objects.get(
                    account_user=post.client, platform='instagram', is_active=True
                )
            except SocialAccount.DoesNotExist:
                logger.warning('publish_scheduled: post %s — no Instagram account for client %s', post.pk, post.client.username)
                continue
            except SocialAccount.MultipleObjectsReturned:
                account = SocialAccount.objects.filter(
                    account_user=post.client, platform='instagram', is_active=True
                ).order_by('-token_last_refreshed').first()

        try:
            decrypted_token = account.decrypted_token
        except Exception as e:
            logger.error('publish_scheduled: post %s — token decryption failed: %s', post.pk, e)
            continue

        if not decrypted_token or (
            account.token_expires_at and account.token_expires_at <= now
        ):
            logger.warning('publish_scheduled: post %s — token missing or expired', post.pk)
            continue

        is_video = post.media_type == 'video'
        media_url = post.video_url if is_video else post.image_url
        if not media_url or media_url.startswith('data:'):
            logger.warning('publish_scheduled: post %s — media not publishable', post.pk)
            continue

        caption_text = post.caption or ''
        if post.hashtags:
            caption_text = f'{caption_text}\n\n{post.hashtags}'.strip()

        try:
            if is_video:
                ig_post_id = instagram_service.publish_reel(
                    decrypted_token,
                    account.instagram_user_id,
                    media_url,
                    caption_text,
                )
            else:
                ig_post_id = instagram_service.publish_image_post(
                    decrypted_token,
                    account.instagram_user_id,
                    media_url,
                    caption_text,
                )
        except instagram_service.InstagramAPIError as e:
            logger.error('publish_scheduled: post %s failed: %s', post.pk, e)
            notify_post_publish_failed(post)
            continue

        with transaction.atomic():
            try:
                locked = Post.objects.select_for_update().get(pk=post.pk)
                if locked.status == 'posted':
                    continue
                locked.status = 'posted'
                locked.instagram_post_id = ig_post_id
                locked.save(update_fields=['status', 'instagram_post_id', 'updated_at'])
            except Post.DoesNotExist:
                continue

        notify_post_published(post)
        logger.info('publish_scheduled: published post %s → %s', post.pk, ig_post_id)
        published += 1

    return published


def seconds_until_next():
    now = timezone.now()
    next_post = (
        Post.objects
        .filter(
            status='scheduled',
            platform='instagram',
            scheduled_time__gt=now,
            deleted_at__isnull=True,
            client__isnull=False,
        )
        .order_by('scheduled_time')
        .values('scheduled_time')
        .first()
    )
    if not next_post:
        return HEARTBEAT_SECONDS
    delta = (next_post['scheduled_time'] - now).total_seconds()
    return min(max(delta + 1, 1), MAX_SLEEP_SECONDS)


class Command(BaseCommand):
    help = 'Precise scheduler: sleeps until next post is due, then publishes.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        if options['dry_run']:
            now = timezone.now()
            due = Post.objects.filter(
                status='scheduled', platform='instagram',
                scheduled_time__lte=now, deleted_at__isnull=True,
                client__isnull=False,
            ).select_related('client')
            for p in due:
                self.stdout.write(f'  [dry-run] post {p.pk} for client {p.client.username if p.client_id else "none"}')
            return

        self.stdout.write(self.style.SUCCESS('Scheduler started. Press Ctrl+C to stop.'))
        while True:
            try:
                published = publish_due()
                if published:
                    self.stdout.write(f'  → published {published} post(s)')
                sleep_secs = seconds_until_next()
                self.stdout.write(f'  next check in {sleep_secs:.0f}s')
                time.sleep(sleep_secs)
            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING('\nScheduler stopped.'))
                break
            except Exception as e:
                logger.error('publish_scheduled: unexpected error: %s', e, exc_info=True)
                time.sleep(HEARTBEAT_SECONDS)
