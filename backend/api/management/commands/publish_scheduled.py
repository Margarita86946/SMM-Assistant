import logging

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api import instagram_service
from api.models import Post, SocialAccount


logger = logging.getLogger('api')


class Command(BaseCommand):
    help = 'Publish Instagram posts whose auto_publish is enabled and scheduled_time has arrived.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List posts that would be published without actually publishing.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        now = timezone.now()

        due_posts = Post.objects.filter(
            auto_publish=True,
            status='scheduled',
            platform='instagram',
            scheduled_time__lte=now,
        ).select_related('user')

        total = due_posts.count()
        if total == 0:
            self.stdout.write('No scheduled Instagram posts are due.')
            return

        self.stdout.write(f'Found {total} due post(s).')

        published = 0
        skipped = 0
        failed = 0

        for post in due_posts:
            if dry_run:
                self.stdout.write(f'  [dry-run] would publish post {post.pk} for {post.user.username}')
                continue

            try:
                account = SocialAccount.objects.get(
                    user=post.user, platform='instagram', is_active=True
                )
            except SocialAccount.DoesNotExist:
                logger.warning('publish_scheduled: skipping post %s — no active Instagram account', post.pk)
                skipped += 1
                continue

            if not account.access_token or (
                account.token_expires_at and account.token_expires_at <= now
            ):
                logger.warning('publish_scheduled: skipping post %s — token expired', post.pk)
                skipped += 1
                continue

            if not post.image_url or post.image_url.startswith('data:'):
                logger.warning('publish_scheduled: skipping post %s — image not reachable', post.pk)
                skipped += 1
                continue

            caption_text = post.caption or ''
            if post.hashtags:
                caption_text = f'{caption_text}\n\n{post.hashtags}'.strip()

            try:
                ig_post_id = instagram_service.publish_image_post(
                    account.access_token,
                    account.instagram_user_id,
                    post.image_url,
                    caption_text,
                )
            except instagram_service.InstagramAPIError as e:
                logger.error('publish_scheduled: post %s failed: %s', post.pk, e)
                failed += 1
                continue

            with transaction.atomic():
                locked = Post.objects.select_for_update().get(pk=post.pk)
                if locked.status == 'posted':
                    logger.info('publish_scheduled: post %s already published, ignoring', post.pk)
                    continue
                locked.status = 'posted'
                locked.instagram_post_id = ig_post_id
                locked.auto_publish = False
                locked.save(update_fields=['status', 'instagram_post_id', 'auto_publish', 'updated_at'])

            published += 1
            self.stdout.write(f'  published post {post.pk} → {ig_post_id}')

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. published={published} skipped={skipped} failed={failed}'
            )
        )
