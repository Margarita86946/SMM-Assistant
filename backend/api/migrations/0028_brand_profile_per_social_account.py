import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0027_add_email_verification_password_reset'),
    ]

    operations = [
        migrations.RunSQL(
            "DELETE FROM brand_profiles;",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RemoveField(
            model_name='brandprofile',
            name='user',
        ),
        migrations.AddField(
            model_name='brandprofile',
            name='social_account',
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='brand_profile',
                to='api.socialaccount',
            ),
            preserve_default=False,
        ),
    ]
