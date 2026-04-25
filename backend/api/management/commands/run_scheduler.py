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


class Command(BaseCommand):
    help = 'Long-running exact-time scheduler for auto-publish posts.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Log what would be published without actually calling Instagram.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        self.stdout.write(self.style.SUCCESS(
            'Scheduler started%s. Press Ctrl+C to stop.' % (' [DRY RUN]' if dry_run else '')
        ))

        while True:
            try:
                published = self._publish_due(dry_run)
                if published:
                    self.stdout.write(f'  → published {published} post(s)')

                sleep_secs = self._seconds_until_next()
                self.stdout.write(
                    f'  next check in {sleep_secs:.0f}s'
                    + (f' (next post due)' if sleep_secs < MAX_SLEEP_SECONDS else ' (heartbeat)')
                )
                time.sleep(sleep_secs)

            except KeyboardInterrupt:
                self.stdout.write(self.style.WARNING('\nScheduler stopped.'))
                break
            except Exception as e:
                logger.error('run_scheduler: unexpected error: %s', e, exc_info=True)
                time.sleep(HEARTBEAT_SECONDS)

    def _publish_due(self, dry_run):
        now = timezone.now()

        due = Post.objects.filter(
            auto_publish=True,
            status='scheduled',
            platform='instagram',
            scheduled_time__lte=now,
            deleted_at__isnull=True,
        ).select_related('user', 'client')

        published = 0
        for post in due:
            ig_owner = post.client if post.client_id else post.user

            if dry_run:
                self.stdout.write(f'  [dry-run] would publish post {post.pk} for {ig_owner.username}')
                published += 1
                continue

            with transaction.atomic():
                try:
                    locked = Post.objects.select_for_update().get(
                        pk=post.pk, status='scheduled'
                    )
                except Post.DoesNotExist:
                    continue

            try:
                account = SocialAccount.objects.get(
                    user=ig_owner, platform='instagram', is_active=True
                )
            except SocialAccount.DoesNotExist:
                logger.warning('run_scheduler: post %s — no Instagram account for %s', post.pk, ig_owner.username)
                continue

            try:
                decrypted_token = account.decrypted_token
            except Exception as e:
                logger.error('run_scheduler: post %s — token decryption failed: %s', post.pk, e)
                continue

            if not decrypted_token or (
                account.token_expires_at and account.token_expires_at <= now
            ):
                logger.warning('run_scheduler: post %s — token missing or expired', post.pk)
                continue

            if not post.image_url or post.image_url.startswith('data:'):
                logger.warning('run_scheduler: post %s — image not publishable', post.pk)
                continue

            caption_text = post.caption or ''
            if post.hashtags:
                caption_text = f'{caption_text}\n\n{post.hashtags}'.strip()

            try:
                ig_post_id = instagram_service.publish_image_post(
                    decrypted_token,
                    account.instagram_user_id,
                    post.image_url,
                    caption_text,
                )
            except instagram_service.InstagramAPIError as e:
                logger.error('run_scheduler: post %s failed: %s', post.pk, e)
                notify_post_publish_failed(post)
                continue

            with transaction.atomic():
                try:
                    locked = Post.objects.select_for_update().get(pk=post.pk)
                    if locked.status == 'posted':
                        continue
                    locked.status = 'posted'
                    locked.instagram_post_id = ig_post_id
                    locked.auto_publish = False
                    locked.save(update_fields=['status', 'instagram_post_id', 'auto_publish', 'updated_at'])
                except Post.DoesNotExist:
                    continue

            notify_post_published(post)
            logger.info('run_scheduler: published post %s → %s', post.pk, ig_post_id)
            published += 1

        return published

    def _seconds_until_next(self):
        now = timezone.now()
        next_post = (
            Post.objects
            .filter(
                auto_publish=True,
                status='scheduled',
                platform='instagram',
                scheduled_time__gt=now,
                deleted_at__isnull=True,
            )
            .order_by('scheduled_time')
            .values('scheduled_time')
            .first()
        )

        if not next_post:
            return HEARTBEAT_SECONDS

        delta = (next_post['scheduled_time'] - now).total_seconds()
        return min(max(delta + 1, 1), MAX_SLEEP_SECONDS)
