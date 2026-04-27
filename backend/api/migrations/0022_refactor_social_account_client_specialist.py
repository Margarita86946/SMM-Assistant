import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0021_video_support'),
    ]

    operations = [
        migrations.RunSQL(
            sql='TRUNCATE TABLE instagram_snapshots CASCADE;',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql='UPDATE client_invitations SET social_account_id = NULL;',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql='UPDATE oauth_states SET invitation_id = NULL;',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunSQL(
            sql='TRUNCATE TABLE social_accounts CASCADE;',
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RemoveField(model_name='oauthstate', name='invitation'),
        migrations.RemoveField(model_name='clientinvitation', name='social_account'),
        migrations.AlterUniqueTogether(
            name='socialaccount',
            unique_together=set(),
        ),
        migrations.RemoveField(model_name='socialaccount', name='user'),
        migrations.RemoveField(model_name='socialaccount', name='owned_by'),
        migrations.RemoveField(model_name='socialaccount', name='is_client_account'),
        migrations.RemoveField(model_name='socialaccount', name='client_email'),
        migrations.AddField(
            model_name='socialaccount',
            name='client',
            field=models.ForeignKey(
                limit_choices_to={'role': 'client'},
                on_delete=django.db.models.deletion.CASCADE,
                related_name='social_accounts',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='socialaccount',
            name='specialist',
            field=models.ForeignKey(
                blank=True,
                limit_choices_to={'role': 'specialist'},
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='managed_accounts',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterUniqueTogether(
            name='socialaccount',
            unique_together={('platform', 'instagram_user_id')},
        ),
    ]
