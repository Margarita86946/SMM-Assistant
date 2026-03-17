from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_post_image_url'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='created_at',
        ),
        migrations.AddField(
            model_name='post',
            name='topic',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='post',
            name='tone',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
