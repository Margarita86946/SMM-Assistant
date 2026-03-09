import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { postsAPI } from '../services/api';
import '../styles/EditPost.css';

function EditPost() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    caption: '',
    hashtags: '',
    platform: 'instagram',
    status: 'draft',
    scheduled_time: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadPost = useCallback(async () => {
    try {
      const response = await postsAPI.getOne(id);
      const post = response.data;
      setFormData({
        caption: post.caption || '',
        hashtags: post.hashtags || '',
        platform: post.platform || 'instagram',
        status: post.status || 'draft',
        scheduled_time: post.scheduled_time
          ? new Date(post.scheduled_time).toISOString().slice(0, 16)
          : '',
      });
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/posts');
      } else {
        setError('Failed to load post');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
      setSuccessMsg('Post updated successfully! Redirecting...');
      setTimeout(() => navigate('/posts'), 1500);
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-post-container">
        <div className="loading">Loading post...</div>
      </div>
    );
  }

  return (
    <div className="edit-post-container">
      <div className="edit-post-header">
        <button className="edit-back-btn" onClick={() => navigate('/posts')}>
          ← Back
        </button>
        <h2>Edit Post #{id}</h2>
      </div>

      <div className="edit-post-card">
        {error && <div className="error-message">{error}</div>}
        {successMsg && <div className="success-message">{successMsg}</div>}

        <div className="edit-form-group">
          <label>Caption</label>
          <textarea
            name="caption"
            value={formData.caption}
            onChange={handleChange}
            rows={5}
          />
        </div>

        <div className="edit-form-group">
          <label>Hashtags</label>
          <input
            type="text"
            name="hashtags"
            value={formData.hashtags}
            onChange={handleChange}
            placeholder="#hashtag1 #hashtag2"
          />
        </div>

        <div className="edit-form-row">
          <div className="edit-form-group">
            <label>Platform</label>
            <select name="platform" value={formData.platform} onChange={handleChange}>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>

          <div className="edit-form-group">
            <label>Status</label>
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="ready_to_post">Ready to Post</option>
              <option value="posted">Posted</option>
            </select>
          </div>
        </div>

        <div className="edit-form-group">
          <label>Scheduled Time (optional)</label>
          <input
            type="datetime-local"
            name="scheduled_time"
            value={formData.scheduled_time}
            onChange={handleChange}
          />
        </div>

        <div className="edit-form-actions">
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditPost;