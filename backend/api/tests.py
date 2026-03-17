from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from .models import User, Post


class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.login_url = reverse('login')

    def test_register_success(self):
        res = self.client.post(self.register_url, {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 201)
        self.assertIn('token', res.data)

    def test_register_duplicate_username(self):
        User.objects.create_user(username='testuser', email='a@a.com', password='pass')
        res = self.client.post(self.register_url, {
            'username': 'testuser',
            'email': 'b@b.com',
            'password': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 400)

    def test_register_duplicate_email(self):
        User.objects.create_user(username='user1', email='same@example.com', password='pass')
        res = self.client.post(self.register_url, {
            'username': 'user2',
            'email': 'same@example.com',
            'password': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 400)

    def test_login_success(self):
        User.objects.create_user(username='testuser', email='t@t.com', password='StrongPass123!')
        res = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'StrongPass123!',
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn('token', res.data)

    def test_login_wrong_password(self):
        User.objects.create_user(username='testuser', email='t@t.com', password='StrongPass123!')
        res = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'wrongpassword',
        })
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.data['error'], 'Invalid credentials')

    def test_login_unknown_user_returns_401(self):
        res = self.client.post(self.login_url, {
            'username': 'nobody',
            'password': 'anything',
        })
        self.assertEqual(res.status_code, 401)


class PostTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser', email='t@t.com', password='StrongPass123!'
        )
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.posts_url = reverse('posts-list')

    def test_create_draft_post(self):
        res = self.client.post(self.posts_url, {
            'caption': 'Hello world',
            'platform': 'instagram',
            'status': 'draft',
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data['caption'], 'Hello world')

    def test_list_posts_paginated(self):
        Post.objects.create(user=self.user, caption='Post 1', platform='instagram', status='draft')
        Post.objects.create(user=self.user, caption='Post 2', platform='linkedin', status='draft')
        res = self.client.get(self.posts_url)
        self.assertEqual(res.status_code, 200)
        self.assertIn('results', res.data)
        self.assertEqual(len(res.data['results']), 2)

    def test_list_posts_requires_auth(self):
        self.client.credentials()
        res = self.client.get(self.posts_url)
        self.assertEqual(res.status_code, 401)

    def test_scheduled_post_requires_time(self):
        res = self.client.post(self.posts_url, {
            'caption': 'Test',
            'platform': 'instagram',
            'status': 'scheduled',
        })
        self.assertEqual(res.status_code, 400)

    def test_delete_post(self):
        post = Post.objects.create(user=self.user, caption='To delete', platform='instagram', status='draft')
        url = reverse('post-detail', args=[post.pk])
        res = self.client.delete(url)
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Post.objects.filter(pk=post.pk).exists())

    def test_cannot_access_other_users_post(self):
        other_user = User.objects.create_user(username='other', email='o@o.com', password='pass')
        post = Post.objects.create(user=other_user, caption='Private', platform='instagram', status='draft')
        url = reverse('post-detail', args=[post.pk])
        res = self.client.get(url)
        self.assertEqual(res.status_code, 404)


class GenerateContentValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='u', email='u@u.com', password='pass')
        self.token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        self.url = reverse('generate-content')

    def test_missing_topic_returns_400(self):
        res = self.client.post(self.url, {'platform': 'instagram', 'tone': 'professional'})
        self.assertEqual(res.status_code, 400)

    def test_topic_too_long_returns_400(self):
        res = self.client.post(self.url, {'topic': 'x' * 501, 'platform': 'instagram', 'tone': 'professional'})
        self.assertEqual(res.status_code, 400)

    def test_invalid_platform_returns_400(self):
        res = self.client.post(self.url, {'topic': 'test', 'platform': 'tiktok', 'tone': 'professional'})
        self.assertEqual(res.status_code, 400)

    def test_invalid_tone_returns_400(self):
        res = self.client.post(self.url, {'topic': 'test', 'platform': 'instagram', 'tone': 'aggressive'})
        self.assertEqual(res.status_code, 400)
