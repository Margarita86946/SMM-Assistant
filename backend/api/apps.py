from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import os
        if os.environ.get('RUN_MAIN', 'true') != 'false':
            _start_scheduler()


def _start_scheduler():
    import os
    import tempfile
    import logging

    logger = logging.getLogger('api')

    if os.environ.get('SCHEDULER_DISABLED') == '1':
        return

    lock_file = None
    try:
        import fcntl
        lock_path = os.path.join(tempfile.gettempdir(), 'smm_scheduler.lock')
        lock_file = open(lock_path, 'w')
        fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except ImportError:
        pass
    except OSError:
        if lock_file:
            lock_file.close()
        logger.info('Scheduler already running in another process, skipping.')
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger
    except ImportError:
        return

    from django.core.management import call_command

    scheduler = BackgroundScheduler()

    def run_publish():
        try:
            call_command('publish_scheduled', verbosity=0)
        except Exception as e:
            logger.error('Scheduler publish_scheduled error: %s', e)

    def run_token_refresh():
        try:
            call_command('refresh_instagram_tokens', verbosity=0)
        except Exception as e:
            logger.error('Scheduler refresh_instagram_tokens error: %s', e)

    def run_reminder():
        try:
            call_command('remind_scheduled', verbosity=0)
        except Exception as e:
            logger.error('Scheduler remind_scheduled error: %s', e)

    scheduler.add_job(run_publish, IntervalTrigger(minutes=5), id='publish_scheduled', replace_existing=True)
    scheduler.add_job(run_reminder, IntervalTrigger(minutes=10), id='remind_scheduled', replace_existing=True)
    scheduler.add_job(run_token_refresh, IntervalTrigger(hours=12), id='refresh_tokens', replace_existing=True)
    scheduler.start()
    logger.info('Background scheduler started (publish every 5 min, reminder every 10 min, token refresh every 12 h)')
