import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import { postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/EditPost.css';

function UnsavedModal({ onLeave, onStay, t }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onStay(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onStay]);

  return (
    <div className="edit-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onStay(); }}>
      <div className="edit-modal">
        <div className="edit-modal-header">
          <span className="edit-modal-icon">⚠️</span>
          <h3>{t('edit.unsavedTitle')}</h3>
        </div>
        <p className="edit-modal-msg">{t('edit.unsavedMsg')}</p>
        <div className="edit-modal-actions">
          <button className="edit-modal-leave-btn" onClick={onLeave}>{t('edit.leave')}</button>
          <button className="edit-modal-stay-btn" onClick={onStay}>{t('edit.stay')}</button>
        </div>
      </div>
    </div>
  );
}

function EditPost() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    caption: '',
    hashtags: '',
    topic: '',
    tone: 'professional',
    image_prompt: '',
    image_url: '',
    platform: 'instagram',
    status: 'draft',
    scheduled_time: '',
  });
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isDirty = originalData !== null && JSON.stringify(formData) !== JSON.stringify(originalData);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    const handler = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const loadPost = useCallback(async () => {
    try {
      const response = await postsAPI.getOne(id);
      const post = response.data;
      const data = {
        caption: post.caption || '',
        hashtags: post.hashtags || '',
        topic: post.topic || '',
        tone: post.tone || 'professional',
        image_prompt: post.image_prompt || '',
        image_url: post.image_url || '',
        platform: post.platform || 'instagram',
        status: post.status || 'draft',
        scheduled_time: (() => {
          if (!post.scheduled_time) return '';
          try {
            const d = new Date(post.scheduled_time);
            return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
          } catch {
            return '';
          }
        })(),
      };
      setFormData(data);
      setOriginalData(data);
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/not-found', { state: { from: `/edit/${id}` } });
      } else {
        setError('edit.failedLoad');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updates = { [name]: value };
    if (name === 'scheduled_time') {
      updates.status = value ? 'scheduled' : 'draft';
    }
    setFormData({ ...formData, ...updates });
  };

  const handleDiscard = () => {
    setFormData(originalData);
    setError('');
    setSuccessMsg('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const dataToSend = {
        ...formData,
        scheduled_time: formData.scheduled_time || null,
      };
      await postsAPI.update(id, dataToSend);
      setOriginalData(formData);
      setSuccessMsg(t('edit.savedMsg'));
      setTimeout(() => navigate('/posts'), 1500);
    } catch (err) {
      setError(err.message || 'edit.failedSave');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-post-container">
        <div className="loading">{t('edit.loading')}</div>
      </div>
    );
  }

  return (
    <div className="edit-post-container">
      {blocker.state === 'blocked' && (
        <UnsavedModal
          t={t}
          onLeave={() => blocker.proceed()}
          onStay={() => blocker.reset()}
        />
      )}

      <div className="edit-post-header">
        <button className="edit-back-btn" onClick={() => navigate('/posts')}>
          {t('edit.back')}
        </button>
        <h2>{t('edit.title')}{id}</h2>
        {isDirty && <span className="edit-dirty-badge">{t('edit.unsavedTitle')}</span>}
      </div>

      <div className="edit-post-card">
        {error && <div className="error-message">{t(error)}</div>}
        {successMsg && <div className="success-message">{successMsg}</div>}

        {formData.image_url && (
          <div className="edit-post-image">
            <img src={formData.image_url} alt="Post visual" />
          </div>
        )}

        <div className="edit-form-group">
          <label>{t('edit.caption')}</label>
          <textarea
            name="caption"
            value={formData.caption}
            onChange={handleChange}
            rows={5}
          />
        </div>

        <div className="edit-form-group">
          <label>{t('edit.hashtags')}</label>
          <input
            type="text"
            name="hashtags"
            value={formData.hashtags}
            onChange={handleChange}
            placeholder={t('edit.hashtagsPlaceholder')}
          />
        </div>

        <div className="edit-form-row">
          <div className="edit-form-group">
            <label>{t('edit.topic')}</label>
            <input
              type="text"
              name="topic"
              value={formData.topic}
              onChange={handleChange}
              placeholder={t('edit.topicPlaceholder')}
            />
          </div>
          <div className="edit-form-group">
            <label>{t('edit.tone')}</label>
            <select name="tone" value={formData.tone} onChange={handleChange}>
              <option value="professional">{t('edit.professional')}</option>
              <option value="casual">{t('edit.casual')}</option>
              <option value="funny">{t('edit.funny')}</option>
              <option value="inspirational">{t('edit.inspirational')}</option>
            </select>
          </div>
        </div>

        <div className="edit-form-group">
          <label>{t('edit.imagePrompt')}</label>
          <textarea
            name="image_prompt"
            value={formData.image_prompt}
            onChange={handleChange}
            rows={3}
            placeholder={t('edit.imagePromptPlaceholder')}
          />
        </div>

        <div className="edit-form-row">
          <div className="edit-form-group">
            <label>{t('edit.platform')}</label>
            <select name="platform" value={formData.platform} onChange={handleChange}>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>

          <div className="edit-form-group">
            <label>{t('edit.status')}</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={!!formData.scheduled_time}
              title={formData.scheduled_time ? t('edit.statusLockedHint') : undefined}
            >
              <option value="draft">{t('edit.draft')}</option>
              <option value="scheduled">{t('edit.scheduled')}</option>
              <option value="ready_to_post">{t('edit.readyToPost')}</option>
              <option value="posted">{t('edit.posted')}</option>
            </select>
          </div>
        </div>

        <div className="edit-form-group">
          <label>{t('edit.scheduledTime')}</label>
          <input
            type="datetime-local"
            name="scheduled_time"
            value={formData.scheduled_time}
            onChange={handleChange}
          />
        </div>

        <div className="edit-form-actions">
          {isDirty && (
            <button className="btn-discard" onClick={handleDiscard}>
              {t('edit.discardChanges')}
            </button>
          )}
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? t('edit.saving') : t('edit.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditPost;
