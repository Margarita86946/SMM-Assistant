import os
import logging
import html

from django.core.mail import EmailMultiAlternatives, get_connection

logger = logging.getLogger('api')

PLATFORM_EMAIL = os.getenv('PLATFORM_EMAIL', '')
PLATFORM_EMAIL_PASSWORD = os.getenv('PLATFORM_EMAIL_PASSWORD', '')
FROM_EMAIL = f'SMM Assistant <{PLATFORM_EMAIL}>'


class EmailDeliveryError(Exception):
    pass


def _get_connection():
    return get_connection(
        backend='django.core.mail.backends.smtp.EmailBackend',
        host='smtp.gmail.com',
        port=587,
        username=PLATFORM_EMAIL,
        password=PLATFORM_EMAIL_PASSWORD,
        use_tls=True,
    )


def _send(subject, text_body, html_body, to):
    if not PLATFORM_EMAIL or not PLATFORM_EMAIL_PASSWORD:
        logger.warning('Platform email not configured — skipping email to %s', to)
        raise EmailDeliveryError('Platform email is not configured.')
    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=FROM_EMAIL,
            to=[to],
            connection=_get_connection(),
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)
    except Exception as e:
        logger.error('Email to %s failed: %s', to, e)
        raise EmailDeliveryError('Failed to send email.') from e


def send_verification_email(user, raw_token):
    from django.conf import settings
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    verify_url = f"{frontend_url}/verify-email/{raw_token}"
    display = (user.get_full_name() or user.username).strip()

    subject = "Verify your SMM Assistant email"
    text_body = (
        f"Hi {display},\n\n"
        f"Please verify your email address by clicking the link below:\n{verify_url}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"If you didn't create an account, you can safely ignore this email.\n\n"
        f"— The SMM Assistant Team\n"
    )
    safe_url = html.escape(verify_url)
    safe_name = html.escape(display)
    html_body = f"""<!doctype html>
<html>
<body style="font-family:Inter,Arial,sans-serif;background:#F8FAFC;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;">Verify your email</h2>
    <p style="color:#374151;line-height:1.5;">Hi {safe_name},</p>
    <p style="color:#374151;line-height:1.5;">
      Thanks for signing up! Please verify your email address to activate your account.
    </p>
    <p style="margin:24px 0;">
      <a href="{safe_url}" style="background:#6366F1;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">
        Verify email address
      </a>
    </p>
    <p style="color:#6B7280;font-size:12px;">
      This link expires in 24 hours.<br/>
      If the button doesn't work: <span style="word-break:break-all;">{safe_url}</span>
    </p>
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
      If you didn't create an account, you can safely ignore this email.
    </p>
  </div>
</body>
</html>"""
    _send(subject, text_body, html_body, user.email)


def send_password_reset_email(user, raw_token):
    from django.conf import settings
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    reset_url = f"{frontend_url}/reset-password/{raw_token}"
    display = (user.get_full_name() or user.username).strip()

    subject = "Reset your SMM Assistant password"
    text_body = (
        f"Hi {display},\n\n"
        f"We received a request to reset your password. Click the link below:\n{reset_url}\n\n"
        f"This link expires in 1 hour. If you didn't request a reset, ignore this email.\n\n"
        f"— The SMM Assistant Team\n"
    )
    safe_url = html.escape(reset_url)
    safe_name = html.escape(display)
    html_body = f"""<!doctype html>
<html>
<body style="font-family:Inter,Arial,sans-serif;background:#F8FAFC;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;">Reset your password</h2>
    <p style="color:#374151;line-height:1.5;">Hi {safe_name},</p>
    <p style="color:#374151;line-height:1.5;">
      We received a request to reset your SMM Assistant password.
    </p>
    <p style="margin:24px 0;">
      <a href="{safe_url}" style="background:#6366F1;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">
        Reset password
      </a>
    </p>
    <p style="color:#6B7280;font-size:12px;">
      This link expires in 1 hour.<br/>
      If the button doesn't work: <span style="word-break:break-all;">{safe_url}</span>
    </p>
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
</body>
</html>"""
    _send(subject, text_body, html_body, user.email)


def send_invitation_email(specialist, client_email, raw_token):
    from django.conf import settings
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    accept_url = f"{frontend_url}/accept-invitation/{raw_token}"
    specialist_display = (specialist.get_full_name() or specialist.username).strip()

    subject = f"{specialist_display} invited you to SMM Assistant"
    text_body = (
        f"Hi,\n\n"
        f"{specialist_display} has invited you to join SMM Assistant as their client "
        f"so they can create and manage social media posts on your behalf.\n\n"
        f"Accept your invitation here:\n{accept_url}\n\n"
        f"If you weren't expecting this, you can safely ignore this email.\n\n"
        f"— The SMM Assistant Team\n"
    )
    safe_name = html.escape(specialist_display)
    safe_url = html.escape(accept_url)
    html_body = f"""<!doctype html>
<html>
<body style="font-family:Inter,Arial,sans-serif;background:#F8FAFC;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;">You've been invited</h2>
    <p style="color:#374151;line-height:1.5;">
      <strong>{safe_name}</strong> has invited you to join SMM Assistant as their client
      so they can create and manage social media posts on your behalf.
    </p>
    <p style="margin:24px 0;">
      <a href="{safe_url}" style="background:#6366F1;color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">
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
    _send(subject, text_body, html_body, client_email)


def send_client_removed_email(specialist, client):
    from django.conf import settings
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    specialist_display = (specialist.get_full_name() or specialist.username).strip()
    client_display = (client.get_full_name() or client.username).strip()

    subject = "Your access to SMM Assistant has been removed"
    text_body = (
        f"Hi {client_display},\n\n"
        f"{specialist_display} has removed you from their workspace on SMM Assistant.\n\n"
        f"Your data, including any connected Instagram accounts, has been safely removed. "
        f"If you believe this was a mistake, please contact {specialist_display} directly.\n\n"
        f"You can still be re-invited to the platform in the future.\n\n"
        f"— The SMM Assistant Team\n"
    )
    safe_specialist = html.escape(specialist_display)
    safe_client = html.escape(client_display)
    safe_url = html.escape(frontend_url)
    html_body = f"""<!doctype html>
<html>
<body style="font-family:Inter,Arial,sans-serif;background:#F8FAFC;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:32px;">
    <h2 style="margin:0 0 12px;color:#111827;">Workspace access removed</h2>
    <p style="color:#374151;line-height:1.5;">Hi {safe_client},</p>
    <p style="color:#374151;line-height:1.5;">
      <strong>{safe_specialist}</strong> has removed you from their workspace on SMM Assistant.
    </p>
    <p style="color:#374151;line-height:1.5;">
      Your data, including any connected Instagram accounts, has been safely removed.
      If you believe this was a mistake, please contact {safe_specialist} directly.
    </p>
    <p style="color:#374151;line-height:1.5;">You can still be re-invited to the platform in the future.</p>
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
      — The SMM Assistant Team<br/>
      <a href="{safe_url}" style="color:#6366F1;">{safe_url}</a>
    </p>
  </div>
</body>
</html>"""
    try:
        _send(subject, text_body, html_body, client.email)
    except EmailDeliveryError:
        pass
