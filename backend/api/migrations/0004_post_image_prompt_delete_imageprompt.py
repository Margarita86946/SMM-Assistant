from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_alter_post_platform_alter_post_scheduled_time_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='image_prompt',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.DeleteModel(
            name='ImagePrompt',
        ),
    ]
