import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/CreatePost.css';

function CreatePost() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [status, setStatus] = useState('draft');
  const [scheduledTime, setScheduledTime] = useState('');

  const [tone, setTone] = useState('professional');
  const [polishing, setPolishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handlePolish = async () => {
    if (!caption.trim()) {
      setError(t('create.captionRequiredPolish'));
      return;
    }
    setPolishing(true);
    setError('');
    try {
      const res = await aiAPI.polishContent({ topic, caption, hashtags, image_prompt: imagePrompt, platform, tone });
      setCaption(res.data.caption);
      setHashtags(res.data.hashtags);
      if (res.data.image_prompt) setImagePrompt(res.data.image_prompt);
    } catch {
      setError(t('create.failedPolish'));
    } finally {
      setPolishing(false);
    }
  };

  const handleSave = async () => {
    if (!caption.trim()) {
      setError(t('create.captionRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await postsAPI.create({ topic, caption, hashtags, tone, image_prompt: imagePrompt, platform, status, scheduled_time: scheduledTime || null });
      setSuccessMsg(t('create.savedMsg'));
      setTimeout(() => navigate('/posts'), 1500);
    } catch {
      setError(t('create.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-container">
      <div className="create-header">
        <div>
          <h1>{t('create.title')}</h1>
          <p className="create-subtitle">{t('create.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMsg && <div className="success-message">{successMsg}</div>}

      <div className="create-card">
        <div className="card-title">
          <span className="card-title-icon">📝</span>
          {t('create.content')}
        </div>

        <div className="create-form-group">
          <label>{t('create.topic')}</label>
          <input
            type="text"
            placeholder={t('create.topicPlaceholder')}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="create-form-row">
          <div className="create-form-group">
            <label>{t('create.platform')}</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>
          <div className="create-form-group">
            <label>{t('create.tone')}</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="professional">{t('create.professional')}</option>
              <option value="casual">{t('create.casual')}</option>
              <option value="funny">{t('create.funny')}</option>
              <option value="inspirational">{t('create.inspirational')}</option>
            </select>
          </div>
        </div>

        <div className="create-form-group">
          <label>{t('create.caption')} <span className="label-required">*</span></label>
          <textarea
            rows={6}
            placeholder={t('create.captionPlaceholder')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        <div className="create-form-group">
          <label>{t('create.hashtags')}</label>
          <input
            type="text"
            placeholder={t('create.hashtagsPlaceholder')}
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
          />
        </div>

        <div className="create-form-group">
          <label>{t('create.imagePrompt')} <span className="label-optional">{t('create.optional')}</span></label>
          <textarea
            rows={3}
            placeholder={t('create.imagePromptPlaceholder')}
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
          />
        </div>

        <button className="btn-ai-assist" onClick={handlePolish} disabled={polishing}>
          {polishing ? (
            <><span className="btn-spinner" /> {t('common.polishing')}</>
          ) : (
            <>{t('common.polishWithAI')}</>
          )}
        </button>
      </div>

      <div className="create-card">
        <div className="card-title">
          <span className="card-title-icon">⚙️</span>
          {t('create.postSettings')}
        </div>

        <div className="create-form-row">
          <div className="create-form-group">
            <label>{t('create.status')}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">{t('create.draft')}</option>
              <option value="scheduled">{t('create.scheduled')}</option>
              <option value="ready_to_post">{t('create.readyToPost')}</option>
              <option value="posted">{t('create.posted')}</option>
            </select>
          </div>
          <div className="create-form-group">
            <label>{t('create.scheduledTime')} <span className="label-optional">{t('create.optional')}</span></label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>
        </div>

        <button className="btn-save-post" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('create.savePost')}
        </button>
      </div>
    </div>
  );
}

export default CreatePost;
