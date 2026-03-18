from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)
        try:
            expiry = token.expiry
            if expiry.is_revoked:
                raise AuthenticationFailed('Token has been revoked.')
            if expiry.expires_at < timezone.now():
                raise AuthenticationFailed('Token has expired.')
        except ObjectDoesNotExist:
            pass
        return (user, token)
