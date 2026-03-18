import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/ContentGenerator.css';

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
            {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
            )}
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

function ContentGenerator() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        topic: '',
        platform: 'instagram',
        tone: 'professional'
    });
    const [generatedContent, setGeneratedContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [regenLoading, setRegenLoading] = useState({ caption: false, hashtags: false, image_prompt: false, image: false });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGenerate = async () => {
        if (!formData.topic.trim()) {
            setError(t('generate.topicRequired'));
            return;
        }
        setLoading(true);
        setError('');
        setGeneratedContent(null);
        setImageUrl(null);
        setDownloading(false);

        try {
            const response = await aiAPI.generateContent(formData);
            setGeneratedContent(response.data);
            setImageLoading(true);
            try {
                const imgRes = await aiAPI.generateImage(formData.topic, formData.platform);
                setImageUrl(imgRes.data.image_url);
            } catch {
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
                const imgRes = await aiAPI.generateImage(formData.topic, formData.platform);
                setImageUrl(imgRes.data.image_url);
            } else {
                const response = await aiAPI.generateContent(formData);
                setGeneratedContent(prev => ({ ...prev, [section]: response.data[section] }));
            }
        } catch {
            setError(t('generate.failedRegen'));
        } finally {
            setRegenLoading(prev => ({ ...prev, [section]: false }));
        }
    };

    const handleSaveAsDraft = async () => {
        if (!generatedContent) return;
        setSaving(true);
        setError('');

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
            });
            setSuccessMsg(t('generate.savedDraft'));
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

    return (
        <div className="generator-container">
            <div className="generator-header">
                <button className="generator-back-btn" onClick={() => navigate('/dashboard')}>
                    {t('generate.back')}
                </button>
                <div className="generator-header-text">
                    <h2>{t('generate.title')}</h2>
                    <p>{t('generate.subtitle')}</p>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {successMsg && <div className="success-message">{successMsg}</div>}

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
                        {imageLoading && <p className="gen-image-status">{t('generate.generatingImage')}</p>}
                        {!imageLoading && imageUrl && (
                            <>
                                <img src={imageUrl} alt="AI generated" className="gen-result-image" />
                                <div className="gen-image-buttons">
                                    <RegenButton onClick={() => handleRegenSection('image')} loading={regenLoading.image} t={t} />
                                    <button className="btn-download-image" onClick={handleDownload} disabled={downloading || regenLoading.image}>
                                        {downloading ? t('generate.downloading') : t('generate.download')}
                                    </button>
                                </div>
                            </>
                        )}
                        {!imageLoading && !imageUrl && <p className="gen-image-status gen-image-error">{t('generate.imageFailed')}</p>}
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
    );
}

export default ContentGenerator;
