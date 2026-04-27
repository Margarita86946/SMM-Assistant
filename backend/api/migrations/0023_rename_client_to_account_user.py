import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_refactor_social_account_client_specialist'),
    ]

    operations = [
        migrations.RenameField(
            model_name='socialaccount',
            old_name='client',
            new_name='account_user',
        ),
        migrations.AlterField(
            model_name='socialaccount',
            name='account_user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='social_accounts',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
