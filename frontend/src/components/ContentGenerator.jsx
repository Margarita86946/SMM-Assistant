import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, postsAPI, brandAPI } from '../services/api';
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
    const [textProvider, setTextProvider] = useState('groq');
    const [imageProvider, setImageProvider] = useState('flux');
    const [ollamaStatus, setOllamaStatus] = useState({ ollama: false, models: [] });
    const [brandProfile, setBrandProfile] = useState(null);
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
    const [variants, setVariants] = useState(null);
    const [variantsLoading, setVariantsLoading] = useState(false);

    useEffect(() => {
        aiAPI.getStatus().then(res => setOllamaStatus(res.data)).catch(() => {});
        brandAPI.get().then(res => setBrandProfile(res.data)).catch(() => setBrandProfile(null));
    }, []);

    const hasBrandContext = brandProfile && (
        brandProfile.brand_name || brandProfile.voice_tone ||
        brandProfile.target_audience || brandProfile.keywords || brandProfile.banned_words
    );

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const fetchImage = async (richPrompt) => {
        const topic = (formData.topic || '').trim();
        const rich = (richPrompt || '').replace(/^["'`]+|["'`]+$/g, '').replace(/\s+/g, ' ').trim();
        let prompt = topic;
        if (imageProvider === 'flux') {
            prompt = topic ? `${topic}, professional photography, high quality` : rich.slice(0, 150);
        } else {
            prompt = rich || topic;
            if (prompt.length > 200) {
                const cut = prompt.slice(0, 200);
                const lastSpace = cut.lastIndexOf(' ');
                prompt = lastSpace > 80 ? cut.slice(0, lastSpace) : cut;
            }
        }
        const imgRes = await aiAPI.generateImage({
            prompt,
            platform: formData.platform,
            image_provider: imageProvider,
        });
        return imgRes.data.image_url;
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
        setVariants(null);

        try {
            const response = await aiAPI.generateContent({ ...formData, provider: textProvider });
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
                const response = await aiAPI.generateContent({ ...formData, provider: textProvider });
                setGeneratedContent(prev => ({ ...prev, [section]: response.data[section] }));
            }
        } catch (err) {
            setError(err.message || t('generate.failedRegen'));
        } finally {
            setRegenLoading(prev => ({ ...prev, [section]: false }));
        }
    };

    const handleGenerateVariants = async () => {
        setVariantsLoading(true);
        setError('');
        try {
            const res = await aiAPI.generateVariants({
                topic: formData.topic,
                platform: formData.platform,
                tone: formData.tone,
                provider: textProvider,
            });
            setVariants(res.data.variants);
        } catch {
            setError(t('generate.failedVariants'));
        } finally {
            setVariantsLoading(false);
        }
    };

    const handleUseVariant = (caption) => {
        setGeneratedContent(prev => ({ ...prev, caption }));
        setVariants(null);
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

            <div className={`brand-banner ${hasBrandContext ? 'brand-banner--ok' : 'brand-banner--warn'}`}>
                {hasBrandContext ? (
                    <span>✓ Using brand context: <strong>{brandProfile.brand_name || 'your brand'}</strong></span>
                ) : (
                    <span>
                        ⚠ Set up your <button className="brand-banner-link" onClick={() => navigate('/account')}>Brand Profile</button> for better AI results
                    </span>
                )}
            </div>

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

                <div className="gen-model-card">
                    <h4 className="gen-model-title">Model Settings</h4>
                    <div className="gen-form-row">
                        <div className="gen-form-group">
                            <label>Text Model</label>
                            <select value={textProvider} onChange={(e) => setTextProvider(e.target.value)}>
                                <option value="groq">Groq / Llama 4 Scout (Cloud)</option>
                                <option value="ollama">
                                    Gemma 3 12B / Local (Ollama) {ollamaStatus.ollama ? '● Online' : '● Offline'}
                                </option>
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
                            {imageProvider === 'flux' && (
                                <p className="gen-model-note">⚡ Flux generates original AI images, not stock photos.</p>
                            )}
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
                                <RegenButton onClick={() => handleRegenSection('caption')} loading={regenLoading.caption} t={t} />
                                <CopyButton text={generatedContent.caption} disabled={regenLoading.caption} />
                            </div>
                        </div>
                        <p>{generatedContent.caption}</p>

                        <div className="gen-variants-row">
                            <button
                                className="btn-variants"
                                onClick={handleGenerateVariants}
                                disabled={variantsLoading}
                            >
                                {variantsLoading ? 'Generating variants…' : 'Generate 3 Variants'}
                            </button>
                        </div>

                        {variants && (
                            <div className="gen-variants-grid">
                                {variants.map((v, idx) => (
                                    <div key={idx} className="gen-variant-card">
                                        <p className="gen-variant-text">{v}</p>
                                        <button
                                            className="btn-use-variant"
                                            onClick={() => handleUseVariant(v)}
                                        >
                                            Use This
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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
                                <img
                                    src={imageUrl}
                                    alt="AI generated"
                                    className="gen-result-image"
                                    referrerPolicy="no-referrer"
                                    onError={() => {
                                        console.error('Image failed to load:', imageUrl);
                                        if (imageRetry < 2) {
                                            setImageRetry(imageRetry + 1);
                                            setImageUrl(imageUrl.replace(/seed=\d+/, `seed=${Math.floor(Math.random() * 10000000)}`));
                                        } else {
                                            setError(`${t('generate.imageFailed')} URL: ${imageUrl}`);
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
                        {!imageLoading && !imageUrl && <p className="gen-image-status gen-image-error">{t('generate.imageFailed')}</p>}
                    </div>

                    <div className="gen-actions">
                        <button className="btn-save-draft" onClick={handleSaveAsDraft} disabled={saving}>
                            {saving ? t('generate.saving') : t('generate.saveAsDraft')}
                        </button>
                        <button
                            className="btn-generate-new"
                            onClick={() => { setGeneratedContent(null); setImageUrl(null); setVariants(null); setFormData({ topic: '', platform: 'instagram', tone: 'professional' }); }}
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
