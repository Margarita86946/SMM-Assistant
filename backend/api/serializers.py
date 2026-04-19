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

    class Meta:
        model = Post
        fields = [
            'id', 'username', 'caption', 'hashtags', 'topic', 'tone',
            'image_prompt', 'image_url', 'platform', 'scheduled_time', 'status',
            'approval_note', 'approved_by',
            'auto_publish', 'instagram_post_id',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'username', 'approved_by', 'instagram_post_id']

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
        ]

    def validate(self, data):
        validate_scheduled_status(data.get('status', 'draft'), data.get('scheduled_time'))
        if data.get('auto_publish') and data.get('platform', 'instagram') != 'instagram':
            raise serializers.ValidationError(
                {'auto_publish': 'Auto-publish is only supported for Instagram posts.'}
            )
        return data


class BrandProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandProfile
        fields = ['brand_name', 'voice_tone', 'target_audience', 'keywords', 'banned_words', 'updated_at']
        read_only_fields = ['updated_at']
