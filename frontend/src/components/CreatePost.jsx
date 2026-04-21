import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, postsAPI, clientsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useActiveClient } from '../context/ActiveClientContext';
import '../styles/CreatePost.css';

function RegenButton({ onClick, loading, t }) {
  return (
    <button
      className={`btn-regen${loading ? ' btn-regen--loading' : ''}`}
      onClick={onClick}
      disabled={loading}
      title={t('generate.regen')}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={loading ? { animation: 'spin 0.7s linear infinite' } : {}}>
        <polyline points="23 4 23 10 17 10"/>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
      </svg>
      {loading ? t('generate.regenLoading') : t('generate.regen')}
    </button>
  );
}

function CreatePost() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [platform, setPlatform] = useState('instagram');

  const [tone, setTone] = useState('professional');
  const { activeClientId, clients: contextClients } = useActiveClient();
  const [clientId, setClientId] = useState(() => activeClientId ? String(activeClientId) : '');
  const [clients, setClients] = useState([]);
  const [autoPublish, setAutoPublish] = useState(false);

  useEffect(() => {
    clientsAPI.list().then(res => setClients(res.data)).catch(() => {});
  }, []);

  // When the active client context changes (e.g. specialist switches client while on this page),
  // keep the selector in sync — but only if the user hasn't manually overridden it yet.
  useEffect(() => {
    setClientId(activeClientId ? String(activeClientId) : '');
  }, [activeClientId]);
  const [polishing, setPolishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [regenLoading, setRegenLoading] = useState({ caption: false, hashtags: false, image_prompt: false });

  const handlePolish = async () => {
    if (!caption.trim()) {
      setError(t('create.captionRequiredPolish'));
      return;
    }
    setPolishing(true);
    setError('');
    try {
      const res = await aiAPI.polishContent({ topic, caption, hashtags, image_prompt: imagePrompt, platform, tone, client_id: clientId || undefined });
      setCaption(res.data.caption);
      setHashtags(res.data.hashtags);
      if (res.data.image_prompt) setImagePrompt(res.data.image_prompt);
    } catch {
      setError(t('create.failedPolish'));
    } finally {
      setPolishing(false);
    }
  };

  const handleRegen = async (field) => {
    if (!topic.trim()) {
      setError(t('create.topicRequiredRegen'));
      return;
    }
    setRegenLoading(prev => ({ ...prev, [field]: true }));
    setError('');
    try {
      const res = await aiAPI.generateContent({ topic, platform, tone, client_id: clientId || undefined });
      if (field === 'caption') setCaption(res.data.caption);
      else if (field === 'hashtags') setHashtags(res.data.hashtags);
      else if (field === 'image_prompt') setImagePrompt(res.data.image_prompt);
    } catch {
      setError(t('generate.failedRegen'));
    } finally {
      setRegenLoading(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleSave = async () => {
    if (!caption.trim()) {
      setError(t('create.captionRequired'));
      return;
    }
    setSaving(true);
    setError('');
    // Use activeClientId from context as authoritative source when a filter is active;
    // fall back to the manual dropdown selection.
    const resolvedClientId = activeClientId ?? (clientId ? parseInt(clientId, 10) : null);
    try {
      await postsAPI.create({
        topic, caption, hashtags, tone,
        image_prompt: imagePrompt,
        platform,
        status: 'draft',
        scheduled_time: null,
        auto_publish: platform === 'instagram' ? autoPublish : false,
        client: resolvedClientId || null,
      });
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
            <select value={platform} onChange={(e) => {
              const next = e.target.value;
              setPlatform(next);
              if (next !== 'instagram') setAutoPublish(false);
            }}>
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

        {clients.length > 0 && (
          <div className="create-form-group">
            <label>
              Assign to Client{' '}
              {activeClientId
                ? <span className="label-context-set">pre-filled from filter</span>
                : <span className="label-optional">{t('create.optional')}</span>
              }
            </label>
            {activeClientId ? (
              <div className="create-client-locked">
                {(() => {
                  const c = clients.find(x => String(x.id) === clientId);
                  return c
                    ? `${[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username} (${c.email})`
                    : clientId;
                })()}
              </div>
            ) : (
              <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— No client (your own post) —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username} ({c.email})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {clientId && (() => {
          const c = clients.find(x => String(x.id) === clientId);
          return c ? (
            <div className="create-brand-banner">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Using brand context for <strong>{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}</strong>
            </div>
          ) : null;
        })()}

        <div className="create-form-group">
          <div className="create-field-label-row">
            <label>{t('create.caption')} <span className="label-required">*</span></label>
            <RegenButton onClick={() => handleRegen('caption')} loading={regenLoading.caption} t={t} />
          </div>
          <textarea
            rows={6}
            placeholder={t('create.captionPlaceholder')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={regenLoading.caption}
          />
        </div>

        <div className="create-form-group">
          <div className="create-field-label-row">
            <label>{t('create.hashtags')}</label>
            <RegenButton onClick={() => handleRegen('hashtags')} loading={regenLoading.hashtags} t={t} />
          </div>
          <input
            type="text"
            placeholder={t('create.hashtagsPlaceholder')}
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            disabled={regenLoading.hashtags}
          />
        </div>

        <div className="create-form-group">
          <div className="create-field-label-row">
            <label>{t('create.imagePrompt')} <span className="label-optional">{t('create.optional')}</span></label>
            <RegenButton onClick={() => handleRegen('image_prompt')} loading={regenLoading.image_prompt} t={t} />
          </div>
          <textarea
            rows={3}
            placeholder={t('create.imagePromptPlaceholder')}
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            disabled={regenLoading.image_prompt}
          />
        </div>

        {platform === 'instagram' && (
          <label className="create-toggle-row">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
            />
            <span className="create-toggle-switch" aria-hidden="true">
              <span className="create-toggle-thumb" />
            </span>
            <span className="create-toggle-text">
              <span className="create-toggle-title">{t('instagram.autoPublishTitle')}</span>
              <span className="create-toggle-hint">{t('instagram.autoPublishHint')}</span>
            </span>
          </label>
        )}

        <button className="btn-ai-assist" onClick={handlePolish} disabled={polishing}>
          {polishing ? (
            <><span className="btn-spinner" /> {t('common.polishing')}</>
          ) : (
            <>{t('common.polishWithAI')}</>
          )}
        </button>

        <button className="btn-save-draft" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('generate.saveAsDraft')}
        </button>
      </div>
    </div>
  );
}

export default CreatePost;
