import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv('GROQ_API_KEY')

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in your .env file")

client = Groq(api_key=GROQ_API_KEY)

def generate_caption(topic, platform, tone):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
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
        return {
            'caption': '',
            'hashtags': '',
            'image_prompt': '',
            'error': str(e)
        }