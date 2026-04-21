import logging
import html

from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection

from .models import EmailConfiguration

logger = logging.getLogger('api')


class EmailDeliveryError(Exception):
    pass


def _connection_and_from(specialist):
    try:
        cfg = specialist.email_config
    except EmailConfiguration.DoesNotExist:
        cfg = None
    if cfg is not None:
        password = cfg.decrypted_smtp_password
        connection = get_connection(
            backend='django.core.mail.backends.smtp.EmailBackend',
            host=cfg.smtp_host,
            port=cfg.smtp_port,
            username=cfg.smtp_user,
            password=password,
            use_tls=True,
        )
        from_email = f"{cfg.from_name} <{cfg.from_email}>".strip()
        return connection, from_email
    connection = get_connection()
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@smm-assistant.local')
    return connection, from_email


def _build_invitation_html(specialist_display, accept_url):
    safe_name = html.escape(specialist_display)
    safe_url = html.escape(accept_url)
    return f"""<!doctype html>
<html>
<body style="font-family: Inter, Arial, sans-serif; background:#F8FAFC; padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;">You've been invited</h2>
    <p style="color:#374151;line-height:1.5;">
      {safe_name} has invited you to connect your Instagram account so they can
      manage your social media posts on your behalf.
    </p>
    <p style="margin:24px 0;">
      <a href="{safe_url}"
         style="background:#6366F1;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">
        Accept invitation
      </a>
    </p>
    <p style="color:#6B7280;font-size:12px;">
      If the button doesn't work, copy and paste this link:<br/>
      <span style="word-break:break-all;">{safe_url}</span>
    </p>
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
      If you weren't expecting this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>"""


def send_invitation_email(specialist, client_email, raw_token):
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    accept_url = f"{frontend_url}/accept-invitation/{raw_token}"

    specialist_display = (specialist.get_full_name() or specialist.username).strip()
    subject = f"{specialist_display} invited you to SMM Assistant"
    text_body = (
        f"Hi,\n\n"
        f"{specialist_display} has invited you to connect your Instagram account "
        f"so they can manage your social media posts.\n\n"
        f"Accept the invitation here:\n{accept_url}\n\n"
        f"If you weren't expecting this, you can safely ignore this email.\n"
    )
    html_body = _build_invitation_html(specialist_display, accept_url)

    try:
        connection, from_email = _connection_and_from(specialist)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=from_email,
            to=[client_email],
            connection=connection,
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
        return True
    except Exception as e:
        logger.error('Invitation email failed: %s', e)
        raise EmailDeliveryError('Failed to send invitation email') from e


def send_test_email(email_config):
    connection = get_connection(
        backend='django.core.mail.backends.smtp.EmailBackend',
        host=email_config.smtp_host,
        port=email_config.smtp_port,
        username=email_config.smtp_user,
        password=email_config.decrypted_smtp_password,
        use_tls=True,
    )
    from_email = f"{email_config.from_name} <{email_config.from_email}>".strip()
    msg = EmailMultiAlternatives(
        subject='SMM Assistant: Email configuration verified',
        body='Your SMM Assistant email configuration is working correctly.',
        from_email=from_email,
        to=[email_config.smtp_user],
        connection=connection,
    )
    try:
        msg.send(fail_silently=False)
        return True
    except Exception as e:
        logger.error('Test email failed: %s', e)
        raise EmailDeliveryError('Failed to send test email') from e
