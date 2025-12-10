from rest_framework import serializers
from .models import User, Post, ImagePrompt


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def create(self, validated_data):
        """Override create to hash password"""
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user


class ImagePromptSerializer(serializers.ModelSerializer):
    """Serializer for ImagePrompt model"""
    
    class Meta:
        model = ImagePrompt
        fields = ['id', 'prompt_text', 'created_at']
        read_only_fields = ['id', 'created_at']


class PostSerializer(serializers.ModelSerializer):
    """Serializer for Post model"""
    image_prompt = ImagePromptSerializer(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Post
        fields = [
            'id',
            'user',
            'username',
            'caption',
            'hashtags',
            'platform',
            'scheduled_time',
            'status',
            'image_prompt',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'username']
    
    def validate_platform(self, value):
        """Ensure platform is valid"""
        valid_platforms = ['instagram', 'linkedin', 'twitter']
        if value.lower() not in valid_platforms:
            raise serializers.ValidationError(
                f"Platform must be one of: {', '.join(valid_platforms)}"
            )
        return value.lower()
    
    def validate_status(self, value):
        """Ensure status is valid"""
        valid_statuses = ['draft', 'scheduled', 'ready_to_post', 'posted']
        if value.lower() not in valid_statuses:
            raise serializers.ValidationError(
                f"Status must be one of: {', '.join(valid_statuses)}"
            )
        return value.lower()


class PostCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating posts with image prompt"""
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
    
    def create(self, validated_data):
        """Create post and associated image prompt if provided"""
        image_prompt_text = validated_data.pop('image_prompt_text', None)
        
        post = Post.objects.create(**validated_data)
        
        if image_prompt_text:
            ImagePrompt.objects.create(
                post=post,
                prompt_text=image_prompt_text
            )
        
        return post