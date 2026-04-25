import logging
from .models import Notification

logger = logging.getLogger('api')


def create_notification(recipient, notification_type, actor=None, post=None):
    try:
        Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            actor=actor,
            post=post,
        )
    except Exception as e:
        logger.error('create_notification failed type=%s recipient=%s: %s', notification_type, recipient.pk, e)


def notify_post_published(post):
    specialist = post.user
    client = post.client

    create_notification(specialist, 'post_published', actor=None, post=post)
    if client and client.pk != specialist.pk:
        create_notification(client, 'post_published', actor=None, post=post)


def notify_post_publish_failed(post):
    create_notification(post.user, 'post_publish_failed', actor=None, post=post)


def notify_post_reminder(post):
    specialist = post.user
    create_notification(specialist, 'post_scheduled_reminder', actor=None, post=post)
    if post.client and post.client.pk != specialist.pk:
        create_notification(post.client, 'post_scheduled_reminder', actor=None, post=post)
