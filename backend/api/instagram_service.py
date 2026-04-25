import os
import time
import logging
import urllib.parse

import requests

logger = logging.getLogger('api')

GRAPH_API_VERSION = 'v21.0'
GRAPH_API_BASE = f'https://graph.instagram.com/{GRAPH_API_VERSION}'
OAUTH_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
OAUTH_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
LONG_LIVED_TOKEN_URL = f'{GRAPH_API_BASE}/access_token'

OAUTH_SCOPES = [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_insights',
]

DEFAULT_TIMEOUT = 30
CONTAINER_POLL_INTERVAL = 2
CONTAINER_POLL_MAX_ATTEMPTS = 30


class InstagramAPIError(Exception):
    pass


def _app_id():
    app_id = os.environ.get('INSTAGRAM_APP_ID')
    if not app_id:
        raise InstagramAPIError('INSTAGRAM_APP_ID is not configured')
    return app_id


def _app_secret():
    secret = os.environ.get('INSTAGRAM_APP_SECRET')
    if not secret:
        raise InstagramAPIError('INSTAGRAM_APP_SECRET is not configured')
    return secret


def _redirect_uri():
    redirect_uri = os.environ.get('INSTAGRAM_REDIRECT_URI')
    if not redirect_uri:
        raise InstagramAPIError('INSTAGRAM_REDIRECT_URI is not configured')
    return redirect_uri


def get_oauth_url(state=None):
    params = {
        'client_id': _app_id(),
        'redirect_uri': _redirect_uri(),
        'response_type': 'code',
        'scope': ','.join(OAUTH_SCOPES),
    }
    if state:
        params['state'] = state
    return f'{OAUTH_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}'


def exchange_code_for_token(code):
    try:
        response = requests.post(
            OAUTH_TOKEN_URL,
            data={
                'client_id': _app_id(),
                'client_secret': _app_secret(),
                'grant_type': 'authorization_code',
                'redirect_uri': _redirect_uri(),
                'code': code,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        return {
            'access_token': data['access_token'],
            'user_id': str(data.get('user_id', '')),
        }
    except requests.HTTPError as e:
        logger.error('Instagram code exchange failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to exchange authorization code')
    except requests.RequestException as e:
        logger.error('Instagram code exchange network error: %s', e)
        raise InstagramAPIError('Network error during authorization')


def refresh_long_lived_token(long_lived_token):
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/refresh_access_token',
            params={
                'grant_type': 'ig_refresh_token',
                'access_token': long_lived_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        return {
            'access_token': data['access_token'],
            'expires_in': data.get('expires_in', 5184000),
        }
    except requests.HTTPError as e:
        logger.error('Refresh long-lived token failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to refresh Instagram token')
    except requests.RequestException as e:
        logger.error('Refresh long-lived token network error: %s', e)
        raise InstagramAPIError('Network error refreshing token')


def get_long_lived_token(short_token):
    try:
        response = requests.get(
            LONG_LIVED_TOKEN_URL,
            params={
                'grant_type': 'ig_exchange_token',
                'client_secret': _app_secret(),
                'access_token': short_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        return {
            'access_token': data['access_token'],
            'expires_in': data.get('expires_in', 5184000),
        }
    except requests.HTTPError as e:
        logger.error('Long-lived token exchange failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to obtain long-lived token')
    except requests.RequestException as e:
        logger.error('Long-lived token network error: %s', e)
        raise InstagramAPIError('Network error during token refresh')


def get_instagram_user_info(access_token):
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/me',
            params={
                'fields': 'user_id,username,account_type',
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        return {
            'instagram_user_id': str(data.get('user_id') or data.get('id', '')),
            'username': data.get('username', ''),
            'account_type': data.get('account_type', ''),
        }
    except requests.HTTPError as e:
        logger.error('Fetch Instagram user info failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to fetch Instagram account info')
    except requests.RequestException as e:
        logger.error('Instagram user info network error: %s', e)
        raise InstagramAPIError('Network error fetching account info')


def _create_media_container(access_token, instagram_user_id, image_url, caption):
    try:
        response = requests.post(
            f'{GRAPH_API_BASE}/{instagram_user_id}/media',
            data={
                'image_url': image_url,
                'caption': caption or '',
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        container_id = data.get('id')
        if not container_id:
            raise InstagramAPIError('Instagram did not return a container id')
        return container_id
    except requests.HTTPError as e:
        logger.error('Create media container failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to create Instagram media container')
    except requests.RequestException as e:
        logger.error('Create media container network error: %s', e)
        raise InstagramAPIError('Network error creating media container')


def check_container_status(access_token, container_id):
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/{container_id}',
            params={'fields': 'status_code,status', 'access_token': access_token},
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except requests.HTTPError as e:
        logger.error('Container status check failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to check media container status')
    except requests.RequestException as e:
        logger.error('Container status network error: %s', e)
        raise InstagramAPIError('Network error checking container status')


def _wait_for_container_ready(access_token, container_id):
    for attempt in range(CONTAINER_POLL_MAX_ATTEMPTS):
        status_data = check_container_status(access_token, container_id)
        status_code = status_data.get('status_code', '').upper()
        if status_code == 'FINISHED':
            return True
        if status_code in {'ERROR', 'EXPIRED'}:
            logger.error('Container %s failed with status=%s full=%s', container_id, status_code, status_data)
            raise InstagramAPIError(f'Media container failed: {status_code}')
        time.sleep(CONTAINER_POLL_INTERVAL)
    raise InstagramAPIError('Media container did not finish processing in time')


def _publish_container(access_token, instagram_user_id, container_id):
    try:
        response = requests.post(
            f'{GRAPH_API_BASE}/{instagram_user_id}/media_publish',
            data={
                'creation_id': container_id,
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        post_id = data.get('id')
        if not post_id:
            raise InstagramAPIError('Instagram did not return a post id')
        return post_id
    except requests.HTTPError as e:
        logger.error('Publish container failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to publish Instagram post')
    except requests.RequestException as e:
        logger.error('Publish container network error: %s', e)
        raise InstagramAPIError('Network error publishing post')


def publish_image_post(access_token, instagram_user_id, image_url, caption):
    container_id = _create_media_container(access_token, instagram_user_id, image_url, caption)
    _wait_for_container_ready(access_token, container_id)
    return _publish_container(access_token, instagram_user_id, container_id)


def _create_reel_container(access_token, instagram_user_id, video_url, caption):
    try:
        response = requests.post(
            f'{GRAPH_API_BASE}/{instagram_user_id}/media',
            data={
                'media_type': 'REELS',
                'video_url': video_url,
                'caption': caption or '',
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        container_id = data.get('id')
        if not container_id:
            raise InstagramAPIError('Instagram did not return a container id for reel')
        return container_id
    except requests.HTTPError as e:
        logger.error('Create reel container failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to create Instagram reel container')
    except requests.RequestException as e:
        logger.error('Create reel container network error: %s', e)
        raise InstagramAPIError('Network error creating reel container')


def publish_reel(access_token, instagram_user_id, video_url, caption):
    container_id = _create_reel_container(access_token, instagram_user_id, video_url, caption)
    _wait_for_container_ready(access_token, container_id)
    return _publish_container(access_token, instagram_user_id, container_id)


def get_account_overview(access_token, instagram_user_id):
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/{instagram_user_id}',
            params={
                'fields': 'username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website,account_type',
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except requests.HTTPError as e:
        logger.error('get_account_overview failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to fetch account overview')
    except requests.RequestException as e:
        logger.error('get_account_overview network error: %s', e)
        raise InstagramAPIError('Network error fetching account overview')


def get_account_insights(access_token, instagram_user_id, period='day', since=None, until=None):
    metrics = 'reach,impressions,profile_views,follower_count,accounts_engaged'
    params = {
        'metric': metrics,
        'period': period,
        'access_token': access_token,
    }
    if since:
        params['since'] = since
    if until:
        params['until'] = until
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/{instagram_user_id}/insights',
            params=params,
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        return response.json().get('data', [])
    except requests.HTTPError as e:
        logger.error('get_account_insights failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to fetch account insights')
    except requests.RequestException as e:
        logger.error('get_account_insights network error: %s', e)
        raise InstagramAPIError('Network error fetching account insights')


def get_media_list(access_token, instagram_user_id, limit=50):
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/{instagram_user_id}/media',
            params={
                'fields': 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
                'limit': limit,
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()
        return data.get('data', [])
    except requests.HTTPError as e:
        logger.error('get_media_list failed: %s %s', e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to fetch media list')
    except requests.RequestException as e:
        logger.error('get_media_list network error: %s', e)
        raise InstagramAPIError('Network error fetching media list')


def get_media_insights(access_token, media_id):
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/{media_id}/insights',
            params={
                'metric': 'reach,impressions,likes,comments,shares,saved,total_interactions',
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        raw = response.json().get('data', [])
        return {item['name']: item.get('values', [{}])[0].get('value', 0) if item.get('values') else item.get('value', 0) for item in raw}
    except requests.HTTPError as e:
        logger.error('get_media_insights failed media=%s: %s %s', media_id, e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to fetch media insights')
    except requests.RequestException as e:
        logger.error('get_media_insights network error: %s', e)
        raise InstagramAPIError('Network error fetching media insights')


def get_audience_demographics(access_token, instagram_user_id):
    results = {}
    breakdowns = [
        ('follower_demographics', 'age,gender', 'age_gender'),
        ('follower_demographics', 'city', 'cities'),
        ('follower_demographics', 'country', 'countries'),
    ]
    for metric, breakdown, key in breakdowns:
        try:
            response = requests.get(
                f'{GRAPH_API_BASE}/{instagram_user_id}/insights',
                params={
                    'metric': metric,
                    'period': 'lifetime',
                    'metric_type': 'total_value',
                    'breakdown': breakdown,
                    'access_token': access_token,
                },
                timeout=DEFAULT_TIMEOUT,
            )
            response.raise_for_status()
            data = response.json().get('data', [])
            results[key] = data[0].get('total_value', {}).get('breakdowns', []) if data else []
        except requests.HTTPError as e:
            logger.warning('get_audience_demographics breakdown=%s failed: %s %s', breakdown, e, getattr(e.response, 'text', ''))
            results[key] = []
        except requests.RequestException as e:
            logger.warning('get_audience_demographics network error breakdown=%s: %s', breakdown, e)
            results[key] = []
    return results


def get_online_followers(access_token, instagram_user_id):
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/{instagram_user_id}/insights',
            params={
                'metric': 'online_followers',
                'period': 'lifetime',
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json().get('data', [])
        if not data:
            return {}
        return data[0].get('values', [{}])[0].get('value', {})
    except (requests.HTTPError, requests.RequestException) as e:
        logger.warning('get_online_followers failed: %s', e)
        return {}


def get_comments(access_token, media_id, limit=50):
    try:
        response = requests.get(
            f'{GRAPH_API_BASE}/{media_id}/comments',
            params={
                'fields': 'id,text,username,timestamp,like_count,replies{id,text,username,timestamp}',
                'limit': limit,
                'access_token': access_token,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        return response.json().get('data', [])
    except requests.HTTPError as e:
        logger.error('get_comments failed media=%s: %s %s', media_id, e, getattr(e.response, 'text', ''))
        raise InstagramAPIError('Failed to fetch comments')
    except requests.RequestException as e:
        logger.error('get_comments network error: %s', e)
        raise InstagramAPIError('Network error fetching comments')
