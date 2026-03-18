from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_alter_post_platform_alter_user_email'),
    ]

    operations = [
        migrations.AlterField(
            model_name='post',
            name='platform',
            field=models.CharField(choices=[('instagram', 'Instagram'), ('linkedin', 'LinkedIn'), ('twitter', 'Twitter')], db_index=True, default='instagram', max_length=15),
        ),
        migrations.AlterField(
            model_name='post',
            name='scheduled_time',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AlterField(
            model_name='post',
            name='status',
            field=models.CharField(choices=[('draft', 'Draft'), ('scheduled', 'Scheduled'), ('ready_to_post', 'Ready to Post'), ('posted', 'Posted')], db_index=True, default='draft', max_length=20),
        ),
    ]
