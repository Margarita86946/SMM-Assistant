import requests
import json

BASE_URL = 'http://localhost:8000/api'

def test_register():
    """Test user registration"""
    print("\n=== Testing User Registration ===")
    response = requests.post(f'{BASE_URL}/auth/register/', json={
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'testpass123'
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json().get('token')

def test_login():
    """Test user login"""
    print("\n=== Testing User Login ===")
    response = requests.post(f'{BASE_URL}/auth/login/', json={
        'username': 'testuser',
        'password': 'testpass123'
    })
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json().get('token')

def test_create_post(token):
    """Test creating a post"""
    print("\n=== Testing Create Post ===")
    headers = {'Authorization': f'Token {token}'}
    response = requests.post(f'{BASE_URL}/posts/', 
        headers=headers,
        json={
            'caption': 'My first AI-generated post!',
            'hashtags': '#AI #SocialMedia #Marketing',
            'platform': 'instagram',
            'status': 'draft',
            'image_prompt_text': 'A beautiful sunset over the ocean'
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    return response.json().get('id')

def test_get_posts(token):
    """Test getting all posts"""
    print("\n=== Testing Get All Posts ===")
    headers = {'Authorization': f'Token {token}'}
    response = requests.get(f'{BASE_URL}/posts/', headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

def test_dashboard_stats(token):
    """Test dashboard stats"""
    print("\n=== Testing Dashboard Stats ===")
    headers = {'Authorization': f'Token {token}'}
    response = requests.get(f'{BASE_URL}/dashboard/stats/', headers=headers)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")

if __name__ == '__main__':
    try:
        token = test_register()
    except:
        token = test_login()
    
    if token:
        post_id = test_create_post(token)
        
        test_get_posts(token)
        
        test_dashboard_stats(token)