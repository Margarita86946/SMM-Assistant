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
OLLAMA_MODEL = "gemma4:e2b"
OLLAMA_TIMEOUT = 120
GEMINI_MODEL = "gemini-2.0-flash-lite"
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
    count = "10-15" if platform == "instagram" else "3-5"
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        timeout=30,
        messages=[{
            "role": "user",
            "content": f"""Generate {count} hashtags for a {platform} post about: {topic}
Rules:
- Return ONLY the hashtags on a single line, nothing else
- No labels, no explanations, no section headers
- Each hashtag starts with #
- Separate with spaces"""
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


def _polish_content_groq(caption, hashtags, image_prompt, topic, platform, tone, brand_profile=None):
    brand_ctx = f"\nBrand context: {brand_profile}" if brand_profile else ""
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        timeout=30,
        messages=[{
            "role": "user",
            "content": f"""Polish this social media post content for {platform} in a {tone} tone.

Topic: {topic if topic else 'not specified'}
Caption: {caption}
Current hashtags: {hashtags}
Current image prompt: {image_prompt if image_prompt else 'none'}{brand_ctx}

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


# ---------- Language detection & translation ----------

# Unicode ranges for non-Latin scripts that models struggle with
_NON_LATIN_RANGES = [
    (0x0530, 0x058F),  # Armenian
    (0x0400, 0x04FF),  # Cyrillic
    (0x0600, 0x06FF),  # Arabic
    (0x4E00, 0x9FFF),  # CJK
    (0x0900, 0x097F),  # Devanagari
    (0x0370, 0x03FF),  # Greek
    (0x10A0, 0x10FF),  # Georgian
]

_LANG_NAMES = {
    (0x0530, 0x058F): 'Armenian',
    (0x0400, 0x04FF): 'Russian',
    (0x0600, 0x06FF): 'Arabic',
    (0x4E00, 0x9FFF): 'Chinese',
    (0x0900, 0x097F): 'Hindi',
    (0x0370, 0x03FF): 'Greek',
    (0x10A0, 0x10FF): 'Georgian',
}


def _detect_non_latin(text):
    """Return the language name if the text contains significant non-Latin script, else None."""
    for start, end in _NON_LATIN_RANGES:
        count = sum(1 for c in text if start <= ord(c) <= end)
        if count >= 2:
            return _LANG_NAMES.get((start, end), 'the original language')
    return None


def _translate(text, target_language, context='social media content'):
    """Translate text to target_language using Groq. Returns translated text."""
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        timeout=30,
        messages=[{
            "role": "user",
            "content": (
                f"Translate the following {context} to {target_language}. "
                f"Return ONLY the translated text, nothing else. "
                f"Do not explain, do not add quotes.\n\n{text}"
            ),
        }],
    )
    return _clean_ai_output(response.choices[0].message.content)


def _lang_instruction(topic):
    """Tell the model to respond in the same language as the topic."""
    return f"IMPORTANT: Detect the language of the topic and write your response in that same language. Topic: {topic}"


def generate_caption_ollama(topic, platform, tone, brand_profile=None):
    brand_ctx = f"Brand context: {brand_profile}. " if brand_profile else ""
    prompt = (
        f"{_lang_instruction(topic)}. "
        f"{brand_ctx}Write a {tone} social media caption for {platform}. "
        f"Make it engaging and appropriate for {platform}. Do not include hashtags. "
        f"Output ONLY the caption text. No preamble, no explanation, no sign-off."
    )
    return _strip_ollama_preamble(_ollama_generate(prompt))


def generate_hashtags_ollama(topic, platform):
    count = "10-15" if platform == 'instagram' else "3-5"
    prompt = (
        f"{_lang_instruction(topic)}. "
        f"Generate {count} hashtags for a {platform} post. "
        f"Output ONLY hashtags on one line separated by spaces, each starting with #. "
        f"No labels, no preamble, no explanation, no sign-off."
    )
    return _strip_ollama_preamble(_ollama_generate(prompt))


def generate_image_prompt_ollama(topic, caption):
    prompt = (
        f"Write a single vivid sentence IN ENGLISH describing an image for a social media post. "
        f"Based on caption: '{caption[:200]}'. Include subject, visual style, lighting, mood. "
        f"Output ONLY the English description sentence. No preamble, no labels, no sign-off."
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

def _generate_raw(topic_en, platform, tone, brand_profile, provider):
    """Generate content in English using the requested provider."""
    if provider == 'ollama':
        return generate_all_content_ollama(topic_en, platform, tone, brand_profile)
    if provider == 'gemini':
        return generate_all_content_gemini(topic_en, platform, tone, brand_profile)
    try:
        caption = generate_caption(topic_en, platform, tone, brand_profile)
        hashtags = generate_hashtags(topic_en, platform)
        image_prompt = generate_image_prompt(topic_en, caption)
        return {'caption': caption, 'hashtags': hashtags, 'image_prompt': image_prompt, 'error': None}
    except Exception as e:
        logger.error('AI content generation failed: %s', e, exc_info=True)
        return {'caption': '', 'hashtags': '', 'image_prompt': '', 'error': 'AI generation failed. Please try again later.'}


def generate_all_content(topic, platform, tone, brand_profile=None, provider='groq'):
    lang = _detect_non_latin(topic)
    topic_for_gen = topic
    if lang:
        try:
            topic_for_gen = _translate(topic, 'English', context='social media post topic keyword')
        except Exception as e:
            logger.warning('Topic translation failed, using original: %s', e)

    result = _generate_raw(topic_for_gen, platform, tone, brand_profile, provider)
    if result.get('error'):
        return result

    if lang:
        try:
            result['caption'] = _translate(result['caption'], lang)
            result['hashtags'] = _translate(result['hashtags'], lang)
            # image_prompt stays in English — image models need it
        except Exception as e:
            logger.warning('Result translation failed, returning English: %s', e)

    return result


def polish_content(caption, hashtags, platform, tone='professional', image_prompt='', topic='', provider='groq', brand_profile=None):
    lang = _detect_non_latin(topic or caption)

    # Translate inputs to English for polishing
    caption_in, hashtags_in, topic_in = caption, hashtags, topic
    if lang:
        try:
            caption_in = _translate(caption, 'English')
            hashtags_in = _translate(hashtags, 'English')
            if topic:
                topic_in = _translate(topic, 'English')
        except Exception as e:
            logger.warning('Polish input translation failed: %s', e)

    if provider == 'ollama':
        result = polish_content_ollama(caption_in, hashtags_in, image_prompt, topic_in, platform, tone)
    elif provider == 'gemini':
        result = polish_content_gemini(caption_in, hashtags_in, image_prompt, topic_in, platform, tone)
    else:
        result = _polish_content_groq(caption_in, hashtags_in, image_prompt, topic_in, platform, tone, brand_profile=brand_profile)

    if lang:
        try:
            result['caption'] = _translate(result['caption'], lang)
            result['hashtags'] = _translate(result['hashtags'], lang)
            # image_prompt stays in English
        except Exception as e:
            logger.warning('Polish result translation failed: %s', e)

    return result


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
        model_available = OLLAMA_MODEL in models
        return {'ollama': model_available, 'models': models}
    except Exception:
        return {'ollama': False, 'models': []}
