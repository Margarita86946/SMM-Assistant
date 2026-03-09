import React, { useState } from 'react';
import { aiAPI, postsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import '../styles/ContentGenerator.css';

function ContentGenerator() {
    const navigate = useNavigate();
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

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGenerate = async () => {
        if (!formData.topic.trim()) {
            setError('Please enter a topic');
            return;
        }
        setLoading(true);
        setError('');
        setGeneratedContent(null);

        try {
            const response = await aiAPI.generateContent(formData);
            setGeneratedContent(response.data);
        } catch (err) {
            setError(err.message || 'Failed to generate content. Please try again.');
        } finally {
            setLoading(false);
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
                image_prompt_text: generatedContent.image_prompt,
                platform: formData.platform,
                status: 'draft'
            });
            setSuccessMsg('Saved as draft! Redirecting to posts...');
            setTimeout(() => navigate('/posts'), 1500);
        } catch (err) {
            setError(err.message || 'Failed to save post. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="generator-container">
            <div className="generator-header">
                <button className="generator-back-btn" onClick={() => navigate('/dashboard')}>
                    ← Back
                </button>
                <div className="generator-header-text">
                    <h2>AI Content Generator</h2>
                    <p>Generate platform-optimized captions, hashtags &amp; image prompts</p>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {successMsg && <div className="success-message">{successMsg}</div>}

            <div className="generator-form-card">
                <div className="gen-form-group">
                    <label>Topic</label>
                    <input
                        type="text"
                        name="topic"
                        placeholder="e.g. morning coffee, fitness tips, product launch..."
                        value={formData.topic}
                        onChange={handleChange}
                    />
                </div>

                <div className="gen-form-row">
                    <div className="gen-form-group">
                        <label>Platform</label>
                        <select name="platform" value={formData.platform} onChange={handleChange}>
                            <option value="instagram">Instagram</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="twitter">Twitter</option>
                        </select>
                    </div>

                    <div className="gen-form-group">
                        <label>Tone</label>
                        <select name="tone" value={formData.tone} onChange={handleChange}>
                            <option value="professional">Professional</option>
                            <option value="casual">Casual</option>
                            <option value="funny">Funny</option>
                            <option value="inspirational">Inspirational</option>
                        </select>
                    </div>
                </div>

                <button className="btn-generate" onClick={handleGenerate} disabled={loading}>
                    {loading ? 'Generating...' : 'Generate Content'}
                </button>
            </div>

            {generatedContent && (
                <div className="generator-results-card">
                    <h3>Generated Content</h3>

                    <div className="gen-result-block">
                        <strong>Caption</strong>
                        <p>{generatedContent.caption}</p>
                    </div>

                    <div className="gen-result-block">
                        <strong>Hashtags</strong>
                        <p>{generatedContent.hashtags}</p>
                    </div>

                    <div className="gen-result-block">
                        <strong>Image Prompt</strong>
                        <p>{generatedContent.image_prompt}</p>
                    </div>

                    <div className="gen-actions">
                        <button className="btn-save-draft" onClick={handleSaveAsDraft} disabled={saving}>
                            {saving ? 'Saving...' : 'Save as Draft'}
                        </button>
                        <button
                            className="btn-generate-new"
                            onClick={() => {
                                setGeneratedContent(null);
                                setSuccessMsg('');
                                setError('');
                                setFormData({ topic: '', platform: 'instagram', tone: 'professional' });
                            }}
                        >
                            Generate New
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ContentGenerator;