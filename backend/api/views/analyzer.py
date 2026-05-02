import os
import logging
import time
from datetime import timedelta

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.utils import timezone

from ..models import SocialAccount, InstagramSnapshot
from .. import instagram_service
from ..encryption import DecryptionError

logger = logging.getLogger('api')

SNAPSHOT_MAX_AGE_MINUTES = 30
_ENV_DEMO_MODE = os.environ.get('DEMO_MODE', '').lower() in ('1', 'true', 'yes')


def _demo_mode(user):
    return _ENV_DEMO_MODE or user.analyzer_demo_mode


def _get_account(request, account_id):
    if _demo_mode(request.user):
        return type('DemoAccount', (), {'id': account_id})()
    try:
        if request.user.role == 'specialist':
            return SocialAccount.objects.get(
                pk=account_id,
                specialist=request.user,
                platform='instagram',
                is_active=True,
            )
        return SocialAccount.objects.get(
            pk=account_id,
            account_user=request.user,
            platform='instagram',
            is_active=True,
        )
    except (SocialAccount.DoesNotExist, ValueError):
        return None


def _fresh_snapshot(account):
    cutoff = timezone.now() - timedelta(minutes=SNAPSHOT_MAX_AGE_MINUTES)
    return (
        InstagramSnapshot.objects
        .filter(social_account=account, fetched_at__gte=cutoff)
        .order_by('-fetched_at')
        .first()
    )


def _fetch_and_cache(account):
    try:
        token = account.decrypted_token
    except DecryptionError:
        raise instagram_service.InstagramAPIError('Token decryption failed')
    if not token:
        raise instagram_service.InstagramAPIError('No access token')

    ig_id = account.instagram_user_id

    overview = instagram_service.get_account_overview(token, ig_id)

    since_ts = int((timezone.now() - timedelta(days=30)).timestamp())
    until_ts = int(timezone.now().timestamp())
    try:
        insights = instagram_service.get_account_insights(token, ig_id, period='day', since=since_ts, until=until_ts)
    except instagram_service.InstagramAPIError:
        insights = []

    raw_media = instagram_service.get_media_list(token, ig_id, limit=50)
    media = []
    for post in raw_media:
        try:
            post['insights'] = instagram_service.get_media_insights(token, post['id'])
        except instagram_service.InstagramAPIError:
            post['insights'] = {}
        media.append(post)

    try:
        audience = instagram_service.get_audience_demographics(token, ig_id)
    except instagram_service.InstagramAPIError:
        audience = {}

    try:
        online_followers = instagram_service.get_online_followers(token, ig_id)
    except instagram_service.InstagramAPIError:
        online_followers = {}

    snapshot = InstagramSnapshot.objects.create(
        social_account=account,
        overview=overview,
        insights=insights,
        media=media,
        audience=audience,
        online_followers=online_followers,
    )
    return snapshot


_demo_seeds = {}


def _get_demo_seed(account_id):
    return _demo_seeds.get(account_id, 42)


def _ensure_snapshot(account, user, seed=None):
    if _demo_mode(user):
        from ..analyzer_demo import get_demo_snapshot
        s = seed if seed is not None else _get_demo_seed(account.id)
        demo = get_demo_snapshot(seed=s)
        return type('FakeSnap', (), demo)()

    snap = _fresh_snapshot(account)
    if snap:
        return snap
    return _fetch_and_cache(account)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analyzer_accounts(request):
    from django.db.models import Q
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    if request.user.role == 'specialist':
        accounts = SocialAccount.objects.filter(
            specialist=request.user,
            platform='instagram',
            is_active=True,
        ).select_related('account_user').order_by('connected_at')
    else:
        accounts = SocialAccount.objects.filter(
            account_user=request.user, platform='instagram', is_active=True
        ).select_related('account_user').order_by('connected_at')

    def _display_name(user):
        full = f'{user.first_name} {user.last_name}'.strip()
        return full if full else user.username

    demo = _demo_mode(request.user)

    def _account_entry(a, idx):
        is_client = request.user.role == 'specialist'
        if demo:
            return {
                'id': a.id,
                'username': 'demobrand',
                'account_type': 'BUSINESS',
                'is_client_account': is_client,
                'client_display_name': 'Demo Client' if is_client else None,
            }
        return {
            'id': a.id,
            'username': a.account_username,
            'account_type': a.account_type,
            'is_client_account': is_client,
            'client_display_name': _display_name(a.account_user) if is_client else None,
        }

    account_list = list(accounts)
    if demo and account_list:
        account_list = account_list[:1]

    if demo and not account_list:
        result = [{
            'id': 0,
            'username': 'demobrand',
            'account_type': 'BUSINESS',
            'is_client_account': False,
            'client_display_name': None,
        }]
    else:
        result = [_account_entry(a, i) for i, a in enumerate(account_list)]

    return Response({
        'accounts': result,
        'demo_mode': demo,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analyzer_overview(request, account_id):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    account = _get_account(request, account_id)
    if not account:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        snap = _ensure_snapshot(account, request.user)
    except instagram_service.InstagramAPIError as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    overview = snap.overview
    insights = snap.insights

    reach_series = []
    impressions_series = []
    follower_series = []

    for item in insights:
        name = item.get('name')
        values = item.get('values') or []
        for v in values:
            val = v.get('value', 0)
            if isinstance(val, dict):
                continue
            point = {'date': (v.get('end_time') or '')[:10], 'value': val}
            if name == 'reach':
                reach_series.append(point)
            elif name == 'impressions':
                impressions_series.append(point)
            elif name == 'follower_count':
                follower_series.append(point)

    total_reach = sum(p['value'] for p in reach_series)
    total_impressions = sum(p['value'] for p in impressions_series)

    media = snap.media
    total_likes = sum(p.get('like_count', 0) for p in media)
    total_comments = sum(p.get('comments_count', 0) for p in media)
    followers = overview.get('followers_count', 0)
    avg_engagement = round((total_likes + total_comments) / max(len(media), 1) / max(followers, 1) * 100, 2)

    return Response({
        'overview': overview,
        'reach_series': reach_series,
        'impressions_series': impressions_series,
        'follower_series': follower_series,
        'summary': {
            'total_reach_30d': total_reach,
            'total_impressions_30d': total_impressions,
            'avg_engagement_rate': avg_engagement,
            'total_posts': len(media),
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analyzer_posts(request, account_id):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    account = _get_account(request, account_id)
    if not account:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        snap = _ensure_snapshot(account, request.user)
    except instagram_service.InstagramAPIError as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    sort_by = request.query_params.get('sort', 'date')
    media = list(snap.media)

    sort_map = {
        'likes': lambda p: p.get('like_count', 0),
        'comments': lambda p: p.get('comments_count', 0),
        'reach': lambda p: p.get('insights', {}).get('reach', 0),
        'engagement': lambda p: p.get('insights', {}).get('total_interactions', 0),
        'date': lambda p: p.get('timestamp', ''),
    }
    key_fn = sort_map.get(sort_by, sort_map['date'])
    media.sort(key=key_fn, reverse=True)

    return Response({'posts': media})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def analyzer_audience(request, account_id):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    account = _get_account(request, account_id)
    if not account:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        snap = _ensure_snapshot(account, request.user)
    except instagram_service.InstagramAPIError as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({
        'audience': snap.audience,
        'online_followers': snap.online_followers,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyzer_ai(request, account_id):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    account = _get_account(request, account_id)
    if not account:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

    try:
        snap = _ensure_snapshot(account, request.user)
    except instagram_service.InstagramAPIError as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    overview = snap.overview
    media = snap.media
    audience = snap.audience
    insights = snap.insights
    online_followers = snap.online_followers

    followers = overview.get('followers_count', 0)
    following = overview.get('follows_count', 0)
    media_count = overview.get('media_count', 0)

    top_posts = sorted(media, key=lambda p: p.get('insights', {}).get('total_interactions', 0), reverse=True)[:5]
    top_posts_summary = [
        {
            'caption': p.get('caption', '')[:120],
            'likes': p.get('like_count', 0),
            'comments': p.get('comments_count', 0),
            'reach': p.get('insights', {}).get('reach', 0),
            'saved': p.get('insights', {}).get('saved', 0),
            'date': p.get('timestamp', '')[:10],
        }
        for p in top_posts
    ]

    total_likes = sum(p.get('like_count', 0) for p in media)
    total_comments = sum(p.get('comments_count', 0) for p in media)
    avg_likes = round(total_likes / max(len(media), 1))
    avg_comments = round(total_comments / max(len(media), 1))
    avg_engagement = round((total_likes + total_comments) / max(len(media), 1) / max(followers, 1) * 100, 2)

    reach_values = [
        v.get('value', 0)
        for item in insights if item.get('name') == 'reach'
        for v in (item.get('values') or [])
        if not isinstance(v.get('value'), dict)
    ]
    avg_reach = round(sum(reach_values) / max(len(reach_values), 1))

    cities_raw = audience.get('cities', [])
    top_cities = [entry.get('dimension_values', ['?'])[0] for entry in cities_raw[:3]]
    countries_raw = audience.get('countries', [])
    top_countries = [entry.get('dimension_values', ['?'])[0] for entry in countries_raw[:3]]

    age_gender_raw = audience.get('age_gender', [])
    top_segments = sorted(age_gender_raw, key=lambda x: x.get('value', 0), reverse=True)[:3]
    segment_text = ', '.join(
        f"{s.get('dimension_values', ['?', '?'])[0]} {s.get('dimension_values', ['?', '?'])[1]} ({s.get('value', 0)})"
        for s in top_segments
    )

    online_followers_text = 'N/A'
    if isinstance(online_followers, dict) and online_followers:
        top_hours = sorted(online_followers.items(), key=lambda x: x[1], reverse=True)[:3]
        online_followers_text = ', '.join(f'{h}:00 UTC ({v} online)' for h, v in top_hours)

    prompt = f"""You are a senior social media strategist analyzing an Instagram account for a specialist.

Account: @{overview.get('username', 'unknown')}
Bio: {overview.get('biography', 'N/A')}
Followers: {followers:,} | Following: {following:,} | Total posts: {media_count}
Avg engagement rate: {avg_engagement}%
Avg likes per post: {avg_likes} | Avg comments: {avg_comments}
Avg daily reach (last 30 days): {avg_reach:,}
Top audience locations: {', '.join(top_cities) or 'N/A'} | Top countries: {', '.join(top_countries) or 'N/A'}
Top audience segments: {segment_text or 'N/A'}
Peak hours when followers are online: {online_followers_text}

Top 5 posts by engagement:
{chr(10).join(f"- \"{p['caption']}\" | Likes: {p['likes']} | Comments: {p['comments']} | Reach: {p['reach']} | Saved: {p['saved']} | Date: {p['date']}" for p in top_posts_summary)}

Provide a concise, actionable analysis structured exactly as:

**What's Working**
- (2-3 bullet points about content themes, formats, or timing that drive high engagement)

**What Needs Improvement**
- (2-3 bullet points with specific issues)

**Best Time to Post**
- (Based on the peak hours data above, give specific hour recommendations in the account's top audience timezone. If peak hours data is N/A, say so explicitly.)

**Content Recommendations for Next 7 Days**
- (3-4 specific post ideas with format and angle)

**Growth Opportunities**
- (2-3 strategic recommendations to grow this account)

Keep each bullet under 2 sentences. Be specific and data-driven. Do not repeat the numbers I gave you unless making a point."""

    try:
        from groq import Groq
        groq_client = Groq(api_key=os.getenv('GROQ_API_KEY'))
        resp = groq_client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            timeout=45,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=1200,
        )
        analysis = resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error('Analyzer AI failed: %s', e)
        return Response({'error': 'AI analysis failed. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({'analysis': analysis})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyzer_refresh(request, account_id):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    account = _get_account(request, account_id)
    if not account:
        return Response({'error': 'Account not found'}, status=status.HTTP_404_NOT_FOUND)

    if _demo_mode(request.user):
        _demo_seeds[account.id] = int(time.time()) % 100000
        return Response({'message': 'Demo data refreshed with new values'})

    try:
        _fetch_and_cache(account)
    except instagram_service.InstagramAPIError as e:
        return Response({'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({'message': 'Data refreshed successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyzer_demo_toggle(request):
    if request.user.role not in ('specialist', 'owner'):
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
    enabled = request.data.get('enabled')
    if not isinstance(enabled, bool):
        return Response({'error': 'enabled must be a boolean'}, status=status.HTTP_400_BAD_REQUEST)
    request.user.analyzer_demo_mode = enabled
    request.user.save(update_fields=['analyzer_demo_mode'])
    return Response({'demo_mode': enabled})
