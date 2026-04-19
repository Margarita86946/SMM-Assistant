import os
import logging
import urllib.parse
import requests
from groq import Groq
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

GROQ_API_KEY = os.getenv('GROQ_API_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in your .env file")

client = Groq(api_key=GROQ_API_KEY)

GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_TAGS_URL = "http://localhost:11434/api/tags"
OLLAMA_MODEL = "gemma3:12b"
OLLAMA_TIMEOUT = 120
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
GEMINI_TIMEOUT = 30


# ---------- Groq (cloud) ----------

def generate_caption(topic, platform, tone, brand_profile=None):
    brand_ctx = f"\nBrand context: {brand_profile}" if brand_profile else ""
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        timeout=30,
        messages=[{
            "role": "user",
            "content": f"""Write a social media caption for {platform}.
Topic: {topic}
Tone: {tone}{brand_ctx}
Rules:
- Make it engaging and natural
- Suitable length for {platform}
- Do NOT include hashtags
- Do NOT wrap the caption in quotes
- Return ONLY the caption text, nothing else"""
        }]
    )
    return _clean_ai_output(response.choices[0].message.content)


def generate_hashtags(topic, platform):
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        timeout=30,
        messages=[{
            "role": "user",
            "content": f"""Generate hashtags for a {platform} post about: {topic}
Rules:
- Return ONLY hashtags, nothing else
- Each hashtag starts with #
- Separate with spaces
- Instagram: 10-15 hashtags
- LinkedIn/Twitter: 3-5 hashtags"""
        }]
    )
    return _clean_ai_output(response.choices[0].message.content)


def generate_image_prompt(topic, caption):
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        timeout=30,
        messages=[{
            "role": "user",
            "content": f"""Create a detailed image generation prompt for this social media post.
Topic: {topic}
Caption: {caption}
Rules:
- Describe the image visually and specifically
- Include style, lighting, mood
- Return ONLY the image prompt, nothing else"""
        }]
    )
    return _clean_ai_output(response.choices[0].message.content)


def _polish_content_groq(caption, hashtags, image_prompt, topic, platform, tone):
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        timeout=30,
        messages=[{
            "role": "user",
            "content": f"""Polish this social media post content for {platform} in a {tone} tone.

Topic: {topic if topic else 'not specified'}
Caption: {caption}
Current hashtags: {hashtags}
Current image prompt: {image_prompt if image_prompt else 'none'}

Rules for caption:
- Fix grammar and improve quality
- Make it suitable length for {platform}
- Keep the original message and intent
- Do NOT include hashtags in the caption

Rules for hashtags:
- Generate relevant hashtags based on the caption
- Instagram: 10-15 hashtags
- LinkedIn/Twitter: 3-5 hashtags
- Each starts with #, separated by spaces

Rules for image prompt:
- Improve or generate a vivid image prompt based on the caption
- Include style, lighting, mood, and composition details
- Return ONLY the prompt text, no labels

Return ONLY in this exact format (no extra text):
CAPTION: [polished caption here]
HASHTAGS: [hashtags here]
IMAGE_PROMPT: [image prompt here]"""
        }]
    )
    text = response.choices[0].message.content.strip()
    return _parse_polish_text(text, caption, hashtags, image_prompt)


def _parse_polish_text(text, caption, hashtags, image_prompt):
    caption_result = caption
    hashtags_result = hashtags
    image_prompt_result = image_prompt
    if 'CAPTION:' in text and 'HASHTAGS:' in text:
        cap_start = text.index('CAPTION:') + len('CAPTION:')
        hash_start = text.index('HASHTAGS:')
        caption_result = text[cap_start:hash_start].strip()
        if 'IMAGE_PROMPT:' in text:
            img_start = text.index('IMAGE_PROMPT:')
            hashtags_result = text[hash_start + len('HASHTAGS:'):img_start].strip()
            image_prompt_result = text[img_start + len('IMAGE_PROMPT:'):].strip()
        else:
            hashtags_result = text[hash_start + len('HASHTAGS:'):].strip()
    return {'caption': caption_result, 'hashtags': hashtags_result, 'image_prompt': image_prompt_result}


# ---------- Ollama (local Gemma) ----------

def _ollama_generate(prompt):
    response = requests.post(
        OLLAMA_URL,
        json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
        timeout=OLLAMA_TIMEOUT,
    )
    return response.json()['response'].strip()


def _strip_ollama_preamble(text):
    import re
    text = re.sub(r'^(here\'?s?|here is|sure|okay|ok|certainly)[^:\n]*[:\n]', '', text, flags=re.IGNORECASE).strip()
    text = re.sub(r'\*\*[^*]+\*\*\s*:?', '', text).strip()
    text = re.sub(r'(hope this helps|let me know|feel free)[^.!?]*[.!?]?\s*$', '', text, flags=re.IGNORECASE).strip()
    text = text.strip('"\'`*_ \n')
    return text


def _clean_ai_output(text):
    text = text.strip()
    while len(text) >= 2 and text[0] in '"\'`' and text[-1] in '"\'`':
        text = text[1:-1].strip()
    return text


def generate_caption_ollama(topic, platform, tone, brand_profile=None):
    brand_ctx = f"Brand context: {brand_profile}. " if brand_profile else ""
    prompt = (
        f"{brand_ctx}Write a {tone} social media caption for {platform} about: {topic}. "
        f"Make it engaging and appropriate for {platform}. Do not include hashtags. "
        f"Output ONLY the caption text. No preamble, no explanation, no sign-off."
    )
    return _strip_ollama_preamble(_ollama_generate(prompt))


def generate_hashtags_ollama(topic, platform):
    count = "10-15" if platform == 'instagram' else "3-5"
    prompt = (
        f"Generate {count} hashtags for a {platform} post about: {topic}. "
        f"Output ONLY hashtags separated by spaces, each starting with #. "
        f"No preamble, no explanation, no sign-off."
    )
    return _strip_ollama_preamble(_ollama_generate(prompt))


def generate_image_prompt_ollama(topic, caption):
    prompt = (
        f"Write a single vivid sentence describing an image for a social media post about '{topic}'. "
        f"Based on caption: '{caption[:200]}'. Include subject, visual style, lighting, mood. "
        f"Output ONLY the description sentence. No preamble like 'Here is', no labels like '**Image:**', no sign-off like 'Hope this helps'."
    )
    return _strip_ollama_preamble(_ollama_generate(prompt))


def generate_all_content_ollama(topic, platform, tone, brand_profile=None):
    try:
        caption = generate_caption_ollama(topic, platform, tone, brand_profile)
        hashtags = generate_hashtags_ollama(topic, platform)
        image_prompt = generate_image_prompt_ollama(topic, caption)
        return {'caption': caption, 'hashtags': hashtags, 'image_prompt': image_prompt, 'error': None}
    except Exception as e:
        logger.error('Ollama generation failed: %s', e, exc_info=True)
        return {
            'caption': '', 'hashtags': '', 'image_prompt': '',
            'error': 'Local AI (Gemma) is not running. Please start Ollama.',
        }


def polish_content_ollama(caption, hashtags, image_prompt, topic, platform, tone):
    prompt = f"""Polish and improve the following social media content for {platform} ({tone} tone).
Topic: {topic}

Current content:
CAPTION: {caption}
HASHTAGS: {hashtags}
IMAGE_PROMPT: {image_prompt}

Return the improved version in EXACTLY this format:
CAPTION: [improved caption]
HASHTAGS: [improved hashtags]
IMAGE_PROMPT: [improved image description]"""
    try:
        text = _ollama_generate(prompt)
        return _parse_polish_text(text, caption, hashtags, image_prompt)
    except Exception as e:
        logger.error('Ollama polish failed: %s', e, exc_info=True)
        return {'caption': caption, 'hashtags': hashtags, 'image_prompt': image_prompt}


# ---------- Gemini (Google, cloud) ----------

def _gemini_generate(prompt):
    if not GEMINI_API_KEY:
        raise RuntimeError('GEMINI_API_KEY is not set in your .env file')
    response = requests.post(
        GEMINI_URL,
        params={'key': GEMINI_API_KEY},
        json={'contents': [{'parts': [{'text': prompt}]}]},
        timeout=GEMINI_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    return data['candidates'][0]['content']['parts'][0]['text'].strip()


def generate_caption_gemini(topic, platform, tone, brand_profile=None):
    brand_ctx = f"\nBrand context: {brand_profile}" if brand_profile else ""
    prompt = f"""Write a social media caption for {platform}.
Topic: {topic}
Tone: {tone}{brand_ctx}
Rules:
- Make it engaging and natural
- Suitable length for {platform}
- Do NOT include hashtags
- Do NOT wrap the caption in quotes
- Return ONLY the caption text, nothing else"""
    return _clean_ai_output(_gemini_generate(prompt))


def generate_hashtags_gemini(topic, platform):
    prompt = f"""Generate hashtags for a {platform} post about: {topic}
Rules:
- Return ONLY hashtags, nothing else
- Each hashtag starts with #
- Separate with spaces
- Instagram: 10-15 hashtags
- LinkedIn/Twitter: 3-5 hashtags"""
    return _clean_ai_output(_gemini_generate(prompt))


def generate_image_prompt_gemini(topic, caption):
    prompt = f"""Create a detailed image generation prompt for this social media post.
Topic: {topic}
Caption: {caption}
Rules:
- Describe the image visually and specifically
- Include style, lighting, mood
- Return ONLY the image prompt, nothing else"""
    return _clean_ai_output(_gemini_generate(prompt))


def generate_all_content_gemini(topic, platform, tone, brand_profile=None):
    try:
        caption = generate_caption_gemini(topic, platform, tone, brand_profile)
        hashtags = generate_hashtags_gemini(topic, platform)
        image_prompt = generate_image_prompt_gemini(topic, caption)
        return {'caption': caption, 'hashtags': hashtags, 'image_prompt': image_prompt, 'error': None}
    except Exception as e:
        logger.error('Gemini generation failed: %s', e, exc_info=True)
        return {
            'caption': '', 'hashtags': '', 'image_prompt': '',
            'error': 'Gemini AI generation failed. Check your GEMINI_API_KEY and quota.',
        }


def polish_content_gemini(caption, hashtags, image_prompt, topic, platform, tone):
    prompt = f"""Polish this social media post content for {platform} in a {tone} tone.

Topic: {topic if topic else 'not specified'}
Caption: {caption}
Current hashtags: {hashtags}
Current image prompt: {image_prompt if image_prompt else 'none'}

Rules for caption:
- Fix grammar and improve quality
- Make it suitable length for {platform}
- Keep the original message and intent
- Do NOT include hashtags in the caption

Rules for hashtags:
- Generate relevant hashtags based on the caption
- Instagram: 10-15 hashtags
- LinkedIn/Twitter: 3-5 hashtags
- Each starts with #, separated by spaces

Rules for image prompt:
- Improve or generate a vivid image prompt based on the caption
- Include style, lighting, mood, and composition details
- Return ONLY the prompt text, no labels

Return ONLY in this exact format (no extra text):
CAPTION: [polished caption here]
HASHTAGS: [hashtags here]
IMAGE_PROMPT: [image prompt here]"""
    try:
        text = _gemini_generate(prompt)
        return _parse_polish_text(text, caption, hashtags, image_prompt)
    except Exception as e:
        logger.error('Gemini polish failed: %s', e, exc_info=True)
        return {'caption': caption, 'hashtags': hashtags, 'image_prompt': image_prompt}


def check_gemini_status():
    if not GEMINI_API_KEY:
        return {'gemini': False, 'error': 'GEMINI_API_KEY not set'}
    try:
        _gemini_generate('ping')
        return {'gemini': True, 'model': GEMINI_MODEL}
    except requests.HTTPError as e:
        try:
            detail = e.response.json().get('error', {}).get('message', str(e))
        except Exception:
            detail = str(e)
        return {'gemini': False, 'error': detail}
    except Exception as e:
        return {'gemini': False, 'error': str(e)}


# ---------- Provider dispatchers ----------

def generate_all_content(topic, platform, tone, brand_profile=None, provider='groq'):
    if provider == 'ollama':
        return generate_all_content_ollama(topic, platform, tone, brand_profile)
    if provider == 'gemini':
        return generate_all_content_gemini(topic, platform, tone, brand_profile)
    try:
        caption = generate_caption(topic, platform, tone, brand_profile)
        hashtags = generate_hashtags(topic, platform)
        image_prompt = generate_image_prompt(topic, caption)
        return {
            'caption': caption,
            'hashtags': hashtags,
            'image_prompt': image_prompt,
            'error': None,
        }
    except Exception as e:
        logger.error('AI content generation failed: %s', e, exc_info=True)
        return {
            'caption': '', 'hashtags': '', 'image_prompt': '',
            'error': 'AI generation failed. Please try again later.',
        }


def polish_content(caption, hashtags, platform, tone='professional', image_prompt='', topic='', provider='groq'):
    if provider == 'ollama':
        return polish_content_ollama(caption, hashtags, image_prompt, topic, platform, tone)
    if provider == 'gemini':
        return polish_content_gemini(caption, hashtags, image_prompt, topic, platform, tone)
    return _polish_content_groq(caption, hashtags, image_prompt, topic, platform, tone)


# ---------- Image (Flux via Pollinations) ----------

def generate_image_flux(prompt, platform='instagram', seed=None):
    import random
    width = 1024
    height = 1024 if platform == 'instagram' else 576
    if seed is None:
        seed = random.randint(1, 10_000_000)
    encoded_prompt = urllib.parse.quote(prompt, safe='')
    return (
        f"https://image.pollinations.ai/prompt/{encoded_prompt}"
        f"?model=flux&width={width}&height={height}&seed={seed}&nologo=true"
    )


# ---------- Ollama status ----------

def check_ollama_status():
    try:
        response = requests.get(OLLAMA_TAGS_URL, timeout=2)
        data = response.json()
        models = [m['name'] for m in data.get('models', [])]
        return {'ollama': True, 'models': models}
    except Exception:
        return {'ollama': False, 'models': []}
