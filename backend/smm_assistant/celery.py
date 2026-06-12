import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smm_assistant.settings')

app = Celery('smm_assistant')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
