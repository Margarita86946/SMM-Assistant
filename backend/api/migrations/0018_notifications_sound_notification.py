from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_add_auto_approve'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='notifications_sound',
            field=models.BooleanField(default=True),
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notification_type', models.CharField(
                    choices=[
                        ('post_submitted', 'Post Submitted for Review'),
                        ('post_approved', 'Post Approved'),
                        ('post_rejected', 'Post Rejected'),
                        ('post_published', 'Post Published'),
                        ('invitation_accepted', 'Invitation Accepted'),
                    ],
                    db_index=True,
                    max_length=30,
                )),
                ('is_read', models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('actor', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='triggered_notifications',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('post', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to='api.post',
                )),
                ('recipient', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notifications',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'notifications',
                'ordering': ['-created_at'],
            },
        ),
    ]
