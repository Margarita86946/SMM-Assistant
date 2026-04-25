from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY')
if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set in your .env file")

DB_PASSWORD = os.getenv('DATABASE_PASSWORD')
if not DB_PASSWORD:
    raise ValueError("DATABASE_PASSWORD is not set in your .env file")

DEBUG = os.getenv('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '192.168.0.15', 'granddad-unneeded-divisible.ngrok-free.dev']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'api.middleware.CoopCoepMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'smm_assistant.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'smm_assistant.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DATABASE_NAME', 'smm_assistant_db'),
        'USER': os.getenv('DATABASE_USER', 'smm_user'),
        'PASSWORD': DB_PASSWORD,
        'HOST': os.getenv('DATABASE_HOST', 'localhost'),
        'PORT': os.getenv('DATABASE_PORT', '5432'),
        # Wrap every request in a transaction. Any unhandled exception will
        # automatically roll back all DB writes made during that request.
        'ATOMIC_REQUESTS': True,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

_cors_env = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://192.168.0.15:3000')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors_env.split(',') if origin.strip()]
CORS_ALLOWED_ORIGIN_REGEXES = [r'^https://.*\.ngrok-free\.app$', r'^https://.*\.ngrok-free\.dev$']

INSTAGRAM_APP_ID = os.environ.get('INSTAGRAM_APP_ID')
INSTAGRAM_APP_SECRET = os.environ.get('INSTAGRAM_APP_SECRET')
INSTAGRAM_REDIRECT_URI = os.environ.get('INSTAGRAM_REDIRECT_URI')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
BACKEND_PUBLIC_URL = os.environ.get('BACKEND_PUBLIC_URL', 'http://localhost:8000').rstrip('/')

MASTER_ENCRYPTION_KEY = os.environ.get('MASTER_ENCRYPTION_KEY', '')
if not DEBUG and not MASTER_ENCRYPTION_KEY:
    raise ValueError('MASTER_ENCRYPTION_KEY must be set in production')

EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend' if DEBUG else 'django.core.mail.backends.smtp.EmailBackend',
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'SMM Assistant <noreply@smm-assistant.local>')

INVITATION_TTL_DAYS = int(os.environ.get('INVITATION_TTL_DAYS', '7'))

CORS_ALLOW_CREDENTIALS = True

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'api': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
    },
}

AUTH_USER_MODEL = 'api.User'

TOKEN_EXPIRY_DAYS = int(os.getenv('TOKEN_EXPIRY_DAYS', '30'))

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'api.authentication.ExpiringTokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
