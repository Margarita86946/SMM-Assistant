from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_post_image_prompt_delete_imageprompt'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='image_url',
            field=models.URLField(blank=True, default='', max_length=1000),
        ),
    ]
