import React, { useState, useEffect } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { aiAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useActiveClient } from '../context/ActiveClientContext';
import { FiCheck, FiCopy, FiRefreshCw } from 'react-icons/fi';
import { PostPreview, CaptionCounter, HashtagsCounter } from './PostPreview';
import '../styles/ContentGenerator.css';

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

function CopyButton({ text, disabled }) {
    const [copied, setCopied] = useState(false);
    const { t } = useTranslation();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    return (
        <button className={`btn-copy${copied ? ' btn-copy--done' : ''}`} onClick={handleCopy} title={t('generate.copy')} disabled={disabled}>
            {copied ? <FiCheck /> : <FiCopy />}
            {copied ? t('generate.copied') : t('generate.copy')}
        </button>
    );
}

function RegenButton({ onClick, loading, t }) {
    return (
        <button
            className={`btn-regen${loading ? ' btn-regen--loading' : ''}`}
            onClick={onClick}
            disabled={loading}
            title={t('generate.regen')}
        >
            <FiRefreshCw style={loading ? { animation: 'spin 0.7s linear infinite' } : {}} />
            {loading ? t('generate.regenLoading') : t('generate.regen')}
        </button>
    );
}

function ContentGenerator() {
    const navigate = useNavigate();
const { t } = useTranslation();
    const { activeClientId, clients } = useActiveClient();
    const role = localStorage.getItem('role');
    const isSpecialist = role === 'specialist';
    const [selectedClientId, setSelectedClientId] = useState(() => activeClientId ? String(activeClientId) : '');

    // Keep in sync when sidebar filter changes
    useEffect(() => {
        setSelectedClientId(activeClientId ? String(activeClientId) : '');
    }, [activeClientId]);

    const [formData, setFormData] = useState({
        topic: '',
        platform: 'instagram',
        tone: 'professional'
    });
    const [textProvider, setTextProvider] = useState('groq');
    const [imageProvider, setImageProvider] = useState('flux');
    const [ollamaStatus, setOllamaStatus] = useState({ ollama: false, models: [] });
    const [generatedContent, setGeneratedContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [imageRetry, setImageRetry] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [regenLoading, setRegenLoading] = useState({ caption: false, hashtags: false, image_prompt: false, image: false });

    useEffect(() => {
        aiAPI.getStatus().then(res => setOllamaStatus(res.data)).catch(() => {});
    }, [isSpecialist]);

    const selectedClient = isSpecialist ? clients.find(c => String(c.id) === selectedClientId) || null : null;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const fetchImage = async (richPrompt) => {
        const prompt = (richPrompt || '').replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').trim()
            || (formData.topic || '').trim();
        const imgRes = await aiAPI.generateImage({
            prompt,
            platform: formData.platform,
            image_provider: imageProvider,
        });
        return imgRes.data.image_url;
    };

    const isDirty = !!(formData.topic || generatedContent);

    const blocker = useBlocker(({ currentLocation, nextLocation }) =>
        isDirty && currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        const handler = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    const handleGenerate = async () => {
        if (!formData.topic.trim()) {
            setError(t('generate.topicRequired'));
            return;
        }
        const resolvedClient = activeClientId ?? (selectedClientId ? parseInt(selectedClientId, 10) : null);
        if (isSpecialist && clients.length > 0 && !resolvedClient) {
            setError(t('generate.clientRequired'));
            return;
        }
        setLoading(true);
        setError('');
        setGeneratedContent(null);
        setImageUrl(null);
        setDownloading(false);

        const clientPayload = selectedClientId ? { client_id: parseInt(selectedClientId, 10) } : {};
        try {
            const response = await aiAPI.generateContent({ ...formData, provider: textProvider, ...clientPayload });
            setGeneratedContent(response.data);
            setImageLoading(true);
            setImageRetry(0);
            try {
                const url = await fetchImage(response.data.image_prompt);
                setImageUrl(url);
            } catch (err) {
                setError(err.response?.data?.error || err.message || t('generate.imageFailed'));
            } finally {
                setImageLoading(false);
            }
        } catch {
            setError(t('generate.failedGenerate'));
        } finally {
            setLoading(false);
        }
    };

    const handleRegenSection = async (section) => {
        setRegenLoading(prev => ({ ...prev, [section]: true }));
        setError('');
        try {
            if (section === 'image') {
                const url = await fetchImage(generatedContent?.image_prompt);
                setImageUrl(url);
            } else {
                const cp = selectedClientId ? { client_id: parseInt(selectedClientId, 10) } : {};
                // Use polishContent so regen is aware of the other existing fields
                const response = await aiAPI.polishContent({
                    topic: formData.topic,
                    caption: generatedContent?.caption || '',
                    hashtags: generatedContent?.hashtags || '',
                    image_prompt: generatedContent?.image_prompt || '',
                    platform: formData.platform,
                    tone: formData.tone,
                    provider: textProvider,
                    ...cp,
                });
                setGeneratedContent(prev => ({ ...prev, [section]: response.data[section] }));
            }
        } catch (err) {
            setError(err.message || t('generate.failedRegen'));
        } finally {
            setRegenLoading(prev => ({ ...prev, [section]: false }));
        }
    };

    const handleSaveAsDraft = async () => {
        if (!generatedContent) return;
        setSaving(true);
        setError('');

        const resolvedClientId = activeClientId ?? (selectedClientId ? parseInt(selectedClientId, 10) : null);

        try {
            await postsAPI.create({
                caption: generatedContent.caption,
                hashtags: generatedContent.hashtags,
                topic: formData.topic,
                tone: formData.tone,
                image_prompt: generatedContent.image_prompt || '',
                image_url: imageUrl || '',
                platform: formData.platform,
                status: 'draft',
                client: resolvedClientId || null,
            });
            setSuccessMsg(t('generate.savedDraft'));
            setGeneratedContent(null); setFormData({ topic: '', platform: 'instagram', tone: 'professional' });
            setTimeout(() => navigate('/posts'), 1500);
        } catch {
            setError(t('generate.failedSave'));
        } finally {
            setSaving(false);
        }
    };

    const handleDownload = async () => {
        if (!imageUrl) return;
        setDownloading(true);
        try {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'post-image.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch {
            setError(t('generate.failedDownload'));
        } finally {
            setDownloading(false);
        }
    };

    const username = localStorage.getItem('username') || '';

    return (
        <div className={`generator-container${generatedContent ? ' generator-container--wide' : ''}`}>
            {blocker.state === 'blocked' && (
                <UnsavedModal t={t} onLeave={() => blocker.proceed()} onStay={() => blocker.reset()} />
            )}
            <div className="generator-header">
                <div className="generator-header-text">
                    <h2>{t('generate.title')}</h2>
                    <p>{t('generate.subtitle')}</p>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {successMsg && <div className="success-message">{successMsg}</div>}

            <div className={generatedContent ? 'generator-two-col' : undefined}>
            <div className={generatedContent ? 'generator-main-col' : undefined}>

            <div className="generator-form-card">
                <div className="gen-form-group">
                    <label>{t('generate.topic')}</label>
                    <input
                        type="text"
                        name="topic"
                        placeholder={t('generate.topicPlaceholder')}
                        value={formData.topic}
                        onChange={handleChange}
                    />
                </div>

                <div className="gen-form-row">
                    <div className="gen-form-group">
                        <label>{t('generate.platform')}</label>
                        <select name="platform" value={formData.platform} onChange={handleChange}>
                            <option value="instagram">Instagram</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="twitter">Twitter</option>
                        </select>
                    </div>

                    <div className="gen-form-group">
                        <label>{t('generate.tone')}</label>
                        <select name="tone" value={formData.tone} onChange={handleChange}>
                            <option value="professional">{t('generate.professional')}</option>
                            <option value="casual">{t('generate.casual')}</option>
                            <option value="funny">{t('generate.funny')}</option>
                            <option value="inspirational">{t('generate.inspirational')}</option>
                        </select>
                    </div>
                </div>

                {isSpecialist && clients.length > 0 && (
                    <div className="gen-form-group">
                        <label>
                            Assign to Client{' '}
                            {activeClientId
                                ? <span className="label-context-set">pre-filled from filter</span>
                                : <span className="label-required">*</span>
                            }
                        </label>
                        {activeClientId ? (
                            <div className="gen-client-locked">
                                {(() => {
                                    const c = clients.find(x => String(x.id) === selectedClientId);
                                    return c
                                        ? [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username
                                        : selectedClientId;
                                })()}
                            </div>
                        ) : (
                            <select
                                value={selectedClientId}
                                onChange={e => setSelectedClientId(e.target.value)}
                            >
                                <option value="">— Select a client —</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}

                {isSpecialist && selectedClient && (
                    <div className="brand-banner brand-banner--ok">
                        <span>✓ Using brand context for <strong>{[selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(' ') || selectedClient.username}</strong></span>
                    </div>
                )}

                <div className="gen-model-card">
                    <h4 className="gen-model-title">Model Settings</h4>
                    <div className="gen-form-row">
                        <div className="gen-form-group">
                            <label>Text Model</label>
                            <select value={textProvider} onChange={(e) => setTextProvider(e.target.value)}>
                                <option value="groq">Groq / Llama 4 Scout (Cloud)</option>
                                <option value="ollama">Gemma 4 E2B / Local (Ollama)</option>
                            </select>
                            {textProvider === 'ollama' && (
                                <p className={`gen-model-status ${ollamaStatus.ollama ? 'gen-model-status--ok' : 'gen-model-status--err'}`}
                                   title={ollamaStatus.ollama ? '' : 'Run `ollama serve` in terminal'}>
                                    {ollamaStatus.ollama ? '● Online' : '● Offline (run `ollama serve`)'}
                                </p>
                            )}
                        </div>

                        <div className="gen-form-group">
                            <label>Image Source</label>
                            <select value={imageProvider} onChange={(e) => setImageProvider(e.target.value)}>
                                <option value="unsplash">Unsplash (Stock Photos)</option>
                                <option value="flux">Flux AI / Pollinations (Generated)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <button className="btn-generate" onClick={handleGenerate} disabled={loading}>
                    {loading ? t('generate.generating') : t('generate.button')}
                </button>
            </div>

            {generatedContent && (
                <div className="generator-results-card">
                    <h3>{t('generate.results')}</h3>


                    <div className={`gen-result-block${regenLoading.caption ? ' gen-result-block--loading' : ''}`}>
                        <div className="gen-result-label-row">
                            <strong>{t('generate.caption')}</strong>
                            <div className="gen-result-actions">
                                <CaptionCounter caption={generatedContent.caption} hashtags={generatedContent.hashtags} platform={formData.platform} />
                                <RegenButton onClick={() => handleRegenSection('caption')} loading={regenLoading.caption} t={t} />
                                <CopyButton text={generatedContent.caption} disabled={regenLoading.caption} />
                            </div>
                        </div>
                        <p>{generatedContent.caption}</p>
                    </div>

                    <div className={`gen-result-block${regenLoading.hashtags ? ' gen-result-block--loading' : ''}`}>
                        <div className="gen-result-label-row">
                            <strong>{t('generate.hashtags')}</strong>
                            <div className="gen-result-actions">
                                <HashtagsCounter hashtags={generatedContent.hashtags} platform={formData.platform} />
                                <RegenButton onClick={() => handleRegenSection('hashtags')} loading={regenLoading.hashtags} t={t} />
                                <CopyButton text={generatedContent.hashtags} disabled={regenLoading.hashtags} />
                            </div>
                        </div>
                        <p>{generatedContent.hashtags}</p>
                    </div>

                    <div className={`gen-result-block${regenLoading.image_prompt ? ' gen-result-block--loading' : ''}`}>
                        <div className="gen-result-label-row">
                            <strong>{t('generate.imagePrompt')}</strong>
                            <div className="gen-result-actions">
                                <RegenButton onClick={() => handleRegenSection('image_prompt')} loading={regenLoading.image_prompt} t={t} />
                                <CopyButton text={generatedContent.image_prompt} disabled={regenLoading.image_prompt} />
                            </div>
                        </div>
                        <p>{generatedContent.image_prompt}</p>
                        {(imageLoading || regenLoading.image) && (
                            <div className="gen-image-loading">
                                <span className="gen-image-spinner" />
                                <span>{regenLoading.image ? 'Regenerating image…' : t('generate.generatingImage')}</span>
                                {imageProvider === 'flux' && <span className="gen-image-loading-hint">Flux can take 30–60s</span>}
                            </div>
                        )}
                        {!imageLoading && !regenLoading.image && imageUrl && (
                            <>
                                <img
                                    src={imageUrl}
                                    alt="AI generated"
                                    className="gen-result-image"
                                    referrerPolicy="no-referrer"
                                    onError={() => {
                                        // Seed-swap retry only works for Pollinations URLs that contain ?seed=
                                        // Flux images saved to /media/ have no seed param — just clear and show error
                                        if (imageUrl.includes('seed=') && imageRetry < 2) {
                                            setImageRetry(imageRetry + 1);
                                            setImageUrl(imageUrl.replace(/seed=\d+/, `seed=${Math.floor(Math.random() * 10000000)}`));
                                        } else {
                                            setError(t('generate.imageFailed'));
                                            setImageUrl(null);
                                            setImageRetry(0);
                                        }
                                    }}
                                />
                                <div className="gen-image-buttons">
                                    <RegenButton onClick={() => handleRegenSection('image')} loading={regenLoading.image} t={t} />
                                    <button className="btn-download-image" onClick={handleDownload} disabled={downloading || regenLoading.image}>
                                        {downloading ? t('generate.downloading') : t('generate.download')}
                                    </button>
                                </div>
                            </>
                        )}
                        {!imageLoading && !regenLoading.image && !imageUrl && <p className="gen-image-status gen-image-error">{t('generate.imageFailed')}</p>}
                    </div>

                    <div className="gen-actions">
                        <button className="btn-save-draft" onClick={handleSaveAsDraft} disabled={saving}>
                            {saving ? t('generate.saving') : t('generate.saveAsDraft')}
                        </button>
                        <button
                            className="btn-generate-new"
                            onClick={() => { setGeneratedContent(null); setImageUrl(null); setFormData({ topic: '', platform: 'instagram', tone: 'professional' }); }}
                        >
                            {t('generate.generateNew')}
                        </button>
                    </div>
                </div>
            )}

            </div>

            {generatedContent && (
                <div className="generator-preview-col">
                    <div className="preview-label">{t('create.previewTitle')}</div>
                    <PostPreview
                        platform={formData.platform}
                        caption={generatedContent.caption}
                        hashtags={generatedContent.hashtags}
                        imageUrl={imageUrl || undefined}
                        username={username}
                    />
                </div>
            )}
            </div>
        </div>
    );
}

export default ContentGenerator;
