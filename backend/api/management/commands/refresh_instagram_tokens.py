import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api import instagram_service
from api.models import SocialAccount


logger = logging.getLogger('api')


class Command(BaseCommand):
    help = 'Refresh Instagram long-lived tokens that are approaching expiry.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Refresh tokens expiring within this many days (default: 7).',
        )

    def handle(self, *args, **options):
        threshold = timezone.now() + timedelta(days=options['days'])
        accounts = SocialAccount.objects.filter(
            platform='instagram',
            is_active=True,
            token_expires_at__isnull=False,
            token_expires_at__lte=threshold,
        )

        total = accounts.count()
        if total == 0:
            self.stdout.write('No Instagram tokens need refreshing.')
            return

        self.stdout.write(f'Refreshing {total} token(s).')

        refreshed = 0
        failed = 0
        for account in accounts:
            if not account.access_token:
                logger.warning('refresh_instagram_tokens: account %s has no token, skipping', account.pk)
                continue
            try:
                result = instagram_service.refresh_long_lived_token(account.access_token)
            except instagram_service.InstagramAPIError as e:
                logger.error('refresh_instagram_tokens: account %s failed: %s', account.pk, e)
                failed += 1
                continue

            account.access_token = result['access_token']
            account.token_expires_at = timezone.now() + timedelta(
                seconds=result.get('expires_in', 5184000)
            )
            account.save(update_fields=['access_token', 'token_expires_at'])
            refreshed += 1
            self.stdout.write(f'  refreshed account {account.pk} ({account.account_username})')

        self.stdout.write(
            self.style.SUCCESS(f'Done. refreshed={refreshed} failed={failed}')
        )
