from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User, Post, BrandProfile


VALID_POST_STATUSES = ['draft', 'scheduled', 'ready_to_post', 'pending_approval', 'approved', 'rejected', 'posted']


def validate_scheduled_status(status_value, scheduled_time):
    if status_value == 'scheduled' and not scheduled_time:
        raise serializers.ValidationError({
            'scheduled_time': 'A scheduled time is required when status is "scheduled".'
        })


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'password', 'role', 'date_joined']
        read_only_fields = ['id', 'date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            try:
                validate_password(password, user)
            except DjangoValidationError as e:
                raise serializers.ValidationError({'password': list(e.messages)})
            user.set_password(password)
        user.save()
        return user


class PostSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    client_username = serializers.CharField(source='client.username', read_only=True, default=None)
    client_first_name = serializers.CharField(source='client.first_name', read_only=True, default=None)
    client_last_name = serializers.CharField(source='client.last_name', read_only=True, default=None)

    class Meta:
        model = Post
        fields = [
            'id', 'username', 'client', 'client_username', 'client_first_name', 'client_last_name',
            'caption', 'hashtags', 'topic', 'tone',
            'image_prompt', 'image_url', 'platform', 'scheduled_time', 'status',
            'approval_note', 'approved_by',
            'auto_publish', 'instagram_post_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'username', 'client_username', 'client_first_name', 'client_last_name', 'approved_by', 'instagram_post_id']

    def validate_platform(self, value):
        valid_platforms = ['instagram', 'linkedin', 'twitter']
        if value.lower() not in valid_platforms:
            raise serializers.ValidationError(
                f"Platform must be one of: {', '.join(valid_platforms)}"
            )
        return value.lower()

    def validate_status(self, value):
        if value.lower() not in VALID_POST_STATUSES:
            raise serializers.ValidationError(
                f"Status must be one of: {', '.join(VALID_POST_STATUSES)}"
            )
        return value.lower()

    def validate(self, data):
        status_value = data.get('status', getattr(self.instance, 'status', None))
        scheduled_time = data.get('scheduled_time', getattr(self.instance, 'scheduled_time', None))
        platform_value = data.get('platform', getattr(self.instance, 'platform', None))
        auto_publish = data.get('auto_publish', getattr(self.instance, 'auto_publish', False))
        validate_scheduled_status(status_value, scheduled_time)
        if auto_publish and platform_value != 'instagram':
            raise serializers.ValidationError(
                {'auto_publish': 'Auto-publish is only supported for Instagram posts.'}
            )
        return data


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = [
            'caption',
            'hashtags',
            'topic',
            'tone',
            'image_prompt',
            'image_url',
            'platform',
            'scheduled_time',
            'status',
            'auto_publish',
            'client',
        ]

    def validate_client(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        if not request:
            return value
        user = request.user
        # Client field can only point to one of the specialist's own clients
        if value.specialist_id != user.id or value.role != 'client':
            raise serializers.ValidationError('This client does not belong to you.')
        return value

    def validate(self, data):
        new_status = data.get('status', getattr(self.instance, 'status', 'draft'))
        current_approval = getattr(self.instance, 'status', None)
        client = data.get('client', getattr(self.instance, 'client', None))

        validate_scheduled_status(new_status, data.get('scheduled_time', getattr(self.instance, 'scheduled_time', None)))

        if data.get('auto_publish') and data.get('platform', getattr(self.instance, 'platform', 'instagram')) != 'instagram':
            raise serializers.ValidationError(
                {'auto_publish': 'Auto-publish is only supported for Instagram posts.'}
            )

        # Client posts must be approved before they can be scheduled
        if new_status == 'scheduled' and client is not None:
            approved = current_approval in ('approved', 'ready_to_post')
            # also allow if the incoming data itself carries approved status (edge case)
            if not approved and data.get('status') == 'scheduled':
                raise serializers.ValidationError(
                    {'status': 'This post must be approved by the client before it can be scheduled.'}
                )

        return data


class BrandProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandProfile
        fields = ['brand_name', 'voice_tone', 'target_audience', 'keywords', 'banned_words', 'updated_at']
        read_only_fields = ['updated_at']
