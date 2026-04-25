import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Post, Notification
from api.notify import notify_post_reminder

logger = logging.getLogger('api')


class Command(BaseCommand):
    help = 'Send reminders for scheduled posts that are X minutes away.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutes',
            type=int,
            default=60,
            help='How many minutes before scheduled_time to send the reminder (default: 60).',
        )

    def handle(self, *args, **options):
        minutes = options['minutes']
        now = timezone.now()
        window_start = now + timedelta(minutes=minutes - 5)
        window_end = now + timedelta(minutes=minutes + 5)

        due_posts = Post.objects.filter(
            status='scheduled',
            auto_publish=True,
            scheduled_time__gte=window_start,
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
            self.stdout.write(f'  reminder sent for post {post.pk} (due {post.scheduled_time})')

        self.stdout.write(self.style.SUCCESS(f'Done. reminders_sent={sent}'))
