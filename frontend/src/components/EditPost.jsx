import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useBlocker } from 'react-router-dom';
import { postsAPI, clientsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useBack } from '../hooks/useBack';
import { PostPreview, CaptionCounter, HashtagsCounter, LIMITS } from './PostPreview';
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
  const goBack = useBack('/posts');
  const { id } = useParams();
  const { t } = useTranslation();
  const role = localStorage.getItem('role');
  const isOwner = role === 'owner';
  const isSpecialist = role === 'specialist';

  const [formData, setFormData] = useState({
    caption: '', hashtags: '', topic: '', tone: 'professional',
    image_prompt: '', image_url: '', video_url: '', media_type: 'image',
    platform: 'instagram', status: 'draft', scheduled_time: '',
  });
  const [originalData, setOriginalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [igAccounts, setIgAccounts] = useState([]);
  const [selectedIgAccount, setSelectedIgAccount] = useState('');

  const isApproved = formData.status === 'approved';
  const isScheduled = formData.status === 'scheduled';
  const contentReadonly = isSpecialist && (isApproved || isScheduled);
  const showScheduling = isOwner
    ? ['draft', 'scheduled'].includes(formData.status)
    : isApproved || isScheduled;

  const isDirty = originalData !== null && JSON.stringify(formData) !== JSON.stringify(originalData);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    const handler = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
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
        video_url: post.video_url || '',
        media_type: post.media_type || 'image',
        platform: post.platform || 'instagram',
        status: post.status || 'draft',
        scheduled_time: (() => {
          if (!post.scheduled_time) return '';
          try {
            const d = new Date(post.scheduled_time);
            if (isNaN(d.getTime())) return '';
            const pad = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          } catch { return ''; }
        })(),
      };
      setFormData(data);
      setOriginalData(data);
      if (post.client && isSpecialist && ['approved', 'scheduled'].includes(post.status)) {
        clientsAPI.igAccounts(post.client).then(res => {
          const accounts = res.data.accounts || [];
          setIgAccounts(accounts);
          if (post.social_account) {
            setSelectedIgAccount(String(post.social_account));
          } else if (accounts.length === 1) {
            setSelectedIgAccount(String(accounts[0].id));
          }
        }).catch(() => {});
      }
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/not-found', { state: { from: `/edit/${id}` } });
      } else {
        setError('edit.failedLoad');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate, isSpecialist]);

  useEffect(() => { loadPost(); }, [loadPost]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleDiscard = () => {
    setFormData(originalData);
    setError('');
    setSuccessMsg('');
  };

  const handleSave = async () => {
    if (showScheduling && isApproved && !formData.scheduled_time) {
      setError(t('edit.scheduledTimeRequired'));
      return;
    }
    if (isSpecialist && showScheduling && igAccounts.length > 1 && !selectedIgAccount) {
      setError(t('edit.selectIgAccount'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { status: _status, ...rest } = formData;
      const scheduledTime = formData.scheduled_time
        ? new Date(formData.scheduled_time).toISOString()
        : null;
      const shouldSetScheduled = scheduledTime && (
        isOwner
          ? ['draft', 'scheduled'].includes(formData.status)
          : formData.status === 'approved'
      );
      const dataToSend = {
        ...rest,
        scheduled_time: scheduledTime,
        ...(shouldSetScheduled ? { status: 'scheduled' } : {}),
        ...(selectedIgAccount ? { social_account: parseInt(selectedIgAccount, 10) } : {}),
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
        <UnsavedModal t={t} onLeave={() => blocker.proceed()} onStay={() => blocker.reset()} />
      )}

      <div className="edit-post-header">
        <button className="edit-back-btn" onClick={goBack}>{t('edit.back')}</button>
        <h2>{t('edit.title')}{id}</h2>
        {isDirty && <span className="edit-dirty-badge">{t('edit.unsavedTitle')}</span>}
      </div>

      <div className="create-layout">
      <div className="create-layout-form">
      <div className="edit-post-card">
        {error && <div className="error-message">{t(error)}</div>}
        {successMsg && <div className="success-message">{successMsg}</div>}

        {formData.media_type === 'video' && formData.video_url ? (
          <div className="edit-post-image">
            <video src={formData.video_url} controls />
          </div>
        ) : formData.image_url ? (
          <div className="edit-post-image">
            <img src={formData.image_url} alt="Post visual" />
          </div>
        ) : null}

        <div className="edit-form-group">
          <div className="edit-field-label-row">
            <label>{t('edit.caption')}</label>
            <CaptionCounter caption={formData.caption} hashtags={formData.hashtags} platform={formData.platform} />
          </div>
          {contentReadonly ? (
            <div className="account-field-readonly" style={{ minHeight: 80, whiteSpace: 'pre-wrap' }}>{formData.caption}</div>
          ) : (
            <textarea
              name="caption"
              value={formData.caption}
              onChange={(e) => {
                const platform = formData.platform;
                const limit = LIMITS[platform]?.caption;
                if (platform === 'twitter') {
                  const combined = [e.target.value, formData.hashtags].filter(Boolean).join(' ');
                  if (limit && combined.length > limit) return;
                } else if (limit && e.target.value.length > limit) return;
                handleChange(e);
              }}
              rows={5}
            />
          )}
        </div>

        <div className="edit-form-group">
          <div className="edit-field-label-row">
            <label>{t('edit.hashtags')}</label>
            <HashtagsCounter hashtags={formData.hashtags} platform={formData.platform} />
          </div>
          {contentReadonly ? (
            <div className="account-field-readonly">{formData.hashtags || '—'}</div>
          ) : (
            <input
              type="text"
              name="hashtags"
              value={formData.hashtags}
              onChange={(e) => {
                const platform = formData.platform;
                if (platform === 'twitter') {
                  const combined = [formData.caption, e.target.value].filter(Boolean).join(' ');
                  if (combined.length > LIMITS.twitter.caption) return;
                } else if (platform === 'instagram') {
                  const tags = e.target.value.trim().split(/\s+/).filter(t => t.startsWith('#')).length;
                  if (tags > LIMITS.instagram.hashtagCount) return;
                }
                handleChange(e);
              }}
              placeholder={t('edit.hashtagsPlaceholder')}
            />
          )}
        </div>

        <div className="edit-form-row">
          <div className="edit-form-group">
            <label>{t('edit.topic')}</label>
            <div className="account-field-readonly">{formData.topic || '—'}</div>
          </div>
          <div className="edit-form-group">
            <label>{t('edit.tone')}</label>
            <div className="account-field-readonly">{formData.tone}</div>
          </div>
        </div>

        {!contentReadonly && (
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
        )}

        <div className="edit-form-group">
          <label>{t('edit.platform')}</label>
          <div className="account-field-readonly">{formData.platform}</div>
        </div>

        {showScheduling && (
          <>
            {isSpecialist && igAccounts.length > 0 && (
              <div className="edit-form-group">
                <label>{t('edit.igAccountLabel')}</label>
                {igAccounts.length === 1 ? (
                  <div className="account-field-readonly">@{igAccounts[0].account_username}</div>
                ) : (
                  <select
                    value={selectedIgAccount}
                    onChange={e => setSelectedIgAccount(e.target.value)}
                  >
                    <option value="">{t('edit.selectAccount')}</option>
                    {igAccounts.map(a => (
                      <option key={a.id} value={a.id}>@{a.account_username}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <div className="edit-form-group">
              <label>{t('edit.scheduledTime')}</label>
              <input
                type="datetime-local"
                name="scheduled_time"
                value={formData.scheduled_time}
                max="2099-12-31T23:59"
                onChange={handleChange}
              />
            </div>
          </>
        )}

        <div className="edit-form-actions">
          {isDirty && (
            <button className="btn-discard" onClick={handleDiscard}>
              {t('edit.discardChanges')}
            </button>
          )}
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? t('edit.saving') : (isApproved ? t('approval.scheduleBtn') : t('edit.saveChanges'))}
          </button>
        </div>
      </div>
      </div>

      <div className="create-layout-preview">
        <div className="preview-label">{t('create.previewTitle')}</div>
        <PostPreview
          platform={formData.platform}
          caption={formData.caption}
          hashtags={formData.hashtags}
          imageUrl={formData.image_url || undefined}
          videoUrl={formData.video_url || undefined}
          mediaType={formData.media_type}
          username={localStorage.getItem('username') || ''}
        />
      </div>
      </div>
    </div>
  );
}

export default EditPost;
