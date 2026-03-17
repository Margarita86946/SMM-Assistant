import os
import logging
from groq import Groq
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

GROQ_API_KEY = os.getenv('GROQ_API_KEY')

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in your .env file")

client = Groq(api_key=GROQ_API_KEY)

def generate_caption(topic, platform, tone):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        timeout=30,
        messages=[{
            "role": "user",
            "content": f"""Write a social media caption for {platform}.
Topic: {topic}
Tone: {tone}
Rules:
- Make it engaging and natural
- Suitable length for {platform}
- Do NOT include hashtags
- Return ONLY the caption text, nothing else"""
        }]
    )
    return response.choices[0].message.content.strip()


def generate_hashtags(topic, platform):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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
    return response.choices[0].message.content.strip()


def generate_image_prompt(topic, caption):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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
    return response.choices[0].message.content.strip()


def polish_content(caption, hashtags, platform, tone='professional', image_prompt='', topic=''):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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


def generate_all_content(topic, platform, tone):
    try:
        caption = generate_caption(topic, platform, tone)
        hashtags = generate_hashtags(topic, platform)
        image_prompt = generate_image_prompt(topic, caption)
        return {
            'caption': caption,
            'hashtags': hashtags,
            'image_prompt': image_prompt,
            'error': None
        }
    except Exception as e:
        logger.error('AI content generation failed: %s', e, exc_info=True)
        return {
            'caption': '',
            'hashtags': '',
            'image_prompt': '',
            'error': 'AI generation failed. Please try again later.'
        }
