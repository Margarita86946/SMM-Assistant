import random
from datetime import datetime, timedelta, timezone

_BASE = datetime(2026, 3, 1, tzinfo=timezone.utc)

_DEMO_PROFILE = {
    'id': '17841400000000001',
    'username': 'demobrand',
    'name': 'Demo Brand',
    'biography': 'Premium lifestyle brand. New drops every Friday. \U0001f6cd️',
    'followers_count': 12840,
    'follows_count': 312,
    'media_count': 87,
    'profile_picture_url': 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=160&h=160&fit=crop&q=80',
    'website': 'https://demobrand.com',
    'account_type': 'BUSINESS',
}

_POSTS = [
    {'caption': 'New arrivals just dropped \U0001f525 Shop the link in bio.', 'img': 'photo-1542291026-7eec264c27ff'},
    {'caption': 'Behind the scenes of our latest shoot ✨ #behindthescenes #fashion', 'img': 'photo-1526170375885-4d8ecf77b99f'},
    {'caption': 'Your weekend look, sorted \U0001f6cd️ #style #fashion #ootd', 'img': 'photo-1483985988355-763728e1935b'},
    {'caption': 'Quality you can feel. Crafted with care. #handmade #quality', 'img': 'photo-1523275335684-37898b6baf30'},
    {'caption': 'Limited edition. Move fast \U0001f680 #limitededition #newdrop', 'img': 'photo-1491553895911-0055eca6402d'},
    {'caption': 'Community spotlight — thank you for the love ❤️ #community', 'img': 'photo-1544005313-94ddf0286df2'},
    {'caption': 'Morning vibes and good coffee ☕ #mornings #lifestyle', 'img': 'photo-1499750310107-5fef28a66643'},
    {'caption': 'The details make the difference. #craftsmanship #design', 'img': 'photo-1531297484001-80022131f5a1'},
    {'caption': 'Friday drop incoming \U0001f440 Stay tuned. #fridaydrop #comingsoon', 'img': 'photo-1460925895917-afdab827c52f'},
    {'caption': 'Summer collection is here \U0001f31e #summer #newcollection #style', 'img': 'photo-1504674900247-0877df9cc836'},
    {'caption': 'Elevate your everyday. ✨ #lifestyle #minimal', 'img': 'photo-1484981138541-3d074aa97716'},
    {'caption': 'Our best-seller is back in stock \U0001f64c #restock #favorites', 'img': 'photo-1567446537708-ac4aa75c9c28'},
    {'caption': 'Designed for those who move fast. ⚡ #performance #gear', 'img': 'photo-1611162617213-7d7a39e9b1d7'},
    {'caption': 'Slow mornings, fast style. ☀️ #morningroutine #fashion', 'img': 'photo-1476514525535-07fb3b4ae5f1'},
    {'caption': 'Made to last. Built with purpose. \U0001f528 #quality #durability', 'img': 'photo-1493770348161-369560ae357d'},
    {'caption': 'Style that speaks without words. \U0001f90d #minimalist #aesthetic', 'img': 'photo-1583744946564-b52ac1c389c8'},
    {'caption': 'Weekend essentials, sorted. \U0001f6d2 #weekend #shopping', 'img': 'photo-1529417305485-480f579e7578'},
    {'caption': 'Comfort meets style. \U0001f60c #cozy #fashion #comfort', 'img': 'photo-1501854140801-50d01698950b'},
    {'caption': 'New season, new you. \U0001f342 #fall #newseason #fashion', 'img': 'photo-1513104890138-7c749659a591'},
    {'caption': 'Bold colors. Bold choices. \U0001f3a8 #colorful #bold #style', 'img': 'photo-1614854262318-831574f15f1f'},
    {'caption': 'The classic never goes out of style. \U0001f5a4 #classic #timeless', 'img': 'photo-1506794778202-cad84cf45f1d'},
    {'caption': 'Live in it. Love it. \U0001f49b #everyday #essentials', 'img': 'photo-1618366712010-f4ae9c647dcb'},
    {'caption': 'Crafted for the ones who care. \U0001f33f #sustainable #conscious', 'img': 'photo-1519125323398-675f0ddb6308'},
    {'caption': 'Your next favorite piece just arrived. \U0001f4e6 #newitem #musthave', 'img': 'photo-1611162616305-c69b3fa7fbe0'},
]


def _ts(days_ago, hour=12):
    return (_BASE + timedelta(days=days_ago, hours=hour)).isoformat()


def demo_overview(seed=0):
    return dict(_DEMO_PROFILE)


def demo_insights(seed=0):
    rng = random.Random(seed)
    data = []
    for i in range(30):
        day = _BASE + timedelta(days=i)
        end = day + timedelta(days=1)
        data.append({'name': 'reach', 'period': 'day', 'values': [{'value': rng.randint(800, 2400), 'end_time': end.isoformat()}], 'title': 'Reach'})
        data.append({'name': 'impressions', 'period': 'day', 'values': [{'value': rng.randint(1200, 4800), 'end_time': end.isoformat()}], 'title': 'Impressions'})
        data.append({'name': 'profile_views', 'period': 'day', 'values': [{'value': rng.randint(40, 220), 'end_time': end.isoformat()}], 'title': 'Profile Views'})
        base_followers = 12400 + i * 15
        data.append({'name': 'follower_count', 'period': 'day', 'values': [{'value': base_followers + rng.randint(-5, 30), 'end_time': end.isoformat()}], 'title': 'Followers'})
    return data


def demo_media(seed=0):
    rng = random.Random(seed + 1000)
    posts = []
    for i, post_def in enumerate(_POSTS):
        likes = rng.randint(80, 1800)
        comments = rng.randint(4, 120)
        reach = likes * rng.uniform(2.5, 6.0)
        impressions = reach * rng.uniform(1.3, 2.2)
        img_url = f'https://images.unsplash.com/{post_def["img"]}?w=600&q=80&fit=crop'
        posts.append({
            'id': f'1784140000000{i:04d}',
            'caption': post_def['caption'],
            'media_type': 'IMAGE',
            'media_url': img_url,
            'thumbnail_url': img_url,
            'permalink': f'https://www.instagram.com/p/demo{i}/',
            'timestamp': _ts(i * 3, hour=rng.randint(9, 20)),
            'like_count': likes,
            'comments_count': comments,
            'insights': {
                'reach': int(reach),
                'impressions': int(impressions),
                'likes': likes,
                'comments': comments,
                'shares': rng.randint(2, 60),
                'saved': rng.randint(10, 200),
                'total_interactions': likes + comments,
            },
        })
    return posts


def demo_audience():
    return {
        'age_gender': [
            {'dimension_values': ['F', '18-24'], 'value': 2180},
            {'dimension_values': ['F', '25-34'], 'value': 3420},
            {'dimension_values': ['F', '35-44'], 'value': 1540},
            {'dimension_values': ['M', '18-24'], 'value': 1260},
            {'dimension_values': ['M', '25-34'], 'value': 2100},
            {'dimension_values': ['M', '35-44'], 'value': 980},
            {'dimension_values': ['F', '45-54'], 'value': 620},
            {'dimension_values': ['M', '45-54'], 'value': 380},
            {'dimension_values': ['U', '65+'], 'value': 160},
        ],
        'cities': [
            {'dimension_values': ['Yerevan, Armenia'], 'value': 3820},
            {'dimension_values': ['Moscow, Russia'], 'value': 1640},
            {'dimension_values': ['Los Angeles, CA'], 'value': 980},
            {'dimension_values': ['Dubai, UAE'], 'value': 740},
            {'dimension_values': ['Paris, France'], 'value': 620},
            {'dimension_values': ['London, UK'], 'value': 540},
            {'dimension_values': ['Berlin, Germany'], 'value': 380},
        ],
        'countries': [
            {'dimension_values': ['AM'], 'value': 4200},
            {'dimension_values': ['RU'], 'value': 2100},
            {'dimension_values': ['US'], 'value': 1840},
            {'dimension_values': ['AE'], 'value': 920},
            {'dimension_values': ['FR'], 'value': 680},
            {'dimension_values': ['GB'], 'value': 560},
            {'dimension_values': ['DE'], 'value': 420},
            {'dimension_values': ['CA'], 'value': 340},
            {'dimension_values': ['AU'], 'value': 280},
        ],
    }


def demo_online_followers(seed=0):
    rng = random.Random(seed + 2000)
    hours = {}
    for day in range(7):
        day_data = {}
        for hour in range(24):
            if 8 <= hour <= 11:
                base = rng.randint(280, 480)
            elif 12 <= hour <= 14:
                base = rng.randint(420, 680)
            elif 18 <= hour <= 22:
                base = rng.randint(560, 920)
            elif 0 <= hour <= 5:
                base = rng.randint(40, 120)
            else:
                base = rng.randint(140, 320)
            day_data[str(hour)] = base
        hours[str(day)] = day_data
    return hours


def get_demo_snapshot(seed=0):
    return {
        'overview': demo_overview(seed),
        'insights': demo_insights(seed),
        'media': demo_media(seed),
        'audience': demo_audience(),
        'online_followers': demo_online_followers(seed),
    }
