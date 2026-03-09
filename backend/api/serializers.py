from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User, Post, ImagePrompt


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'created_at']
        read_only_fields = ['id', 'created_at']

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


class ImagePromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImagePrompt
        fields = ['id', 'prompt_text', 'created_at']
        read_only_fields = ['id', 'created_at']


class PostSerializer(serializers.ModelSerializer):
    image_prompt = ImagePromptSerializer(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'username', 'caption', 'hashtags',
            'platform', 'scheduled_time', 'status',
            'image_prompt', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'username']

    def validate_platform(self, value):
        valid_platforms = ['instagram', 'linkedin', 'twitter']
        if value.lower() not in valid_platforms:
            raise serializers.ValidationError(
                f"Platform must be one of: {', '.join(valid_platforms)}"
            )
        return value.lower()

    def validate_status(self, value):
        valid_statuses = ['draft', 'scheduled', 'ready_to_post', 'posted']
        if value.lower() not in valid_statuses:
            raise serializers.ValidationError(
                f"Status must be one of: {', '.join(valid_statuses)}"
            )
        return value.lower()

    def validate(self, data):
        status = data.get('status', getattr(self.instance, 'status', None))
        scheduled_time = data.get('scheduled_time', getattr(self.instance, 'scheduled_time', None))
        if status == 'scheduled' and not scheduled_time:
            raise serializers.ValidationError({
                'scheduled_time': 'A scheduled time is required when status is "scheduled".'
            })
        return data


class PostCreateSerializer(serializers.ModelSerializer):
    image_prompt_text = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True
    )

    class Meta:
        model = Post
        fields = [
            'caption',
            'hashtags',
            'platform',
            'scheduled_time',
            'status',
            'image_prompt_text'
        ]

    def validate(self, data):
        status = data.get('status', 'draft')
        scheduled_time = data.get('scheduled_time')
        if status == 'scheduled' and not scheduled_time:
            raise serializers.ValidationError({
                'scheduled_time': 'A scheduled time is required when status is "scheduled".'
            })
        return data

    def create(self, validated_data):
        image_prompt_text = validated_data.pop('image_prompt_text', None)
        post = Post.objects.create(**validated_data)
        if image_prompt_text:
            ImagePrompt.objects.create(post=post, prompt_text=image_prompt_text)
        return post