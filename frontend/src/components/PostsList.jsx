import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import '../styles/PostsList.css';

const PLATFORM_LABELS = {
  instagram: '📷 Instagram',
  linkedin:  '💼 LinkedIn',
  twitter:   '🐦 Twitter',
};

function PostsList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await postsAPI.getAll();
      setPosts(response.data.results ?? response.data);
      setLoading(false);
    } catch {
      setError('posts.failedLoad');
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm(t('posts.confirmDelete'))) {
      try {
        await postsAPI.delete(id);
        setPosts(posts.filter(post => post.id !== id));
      } catch {
        alert(t('posts.failedDelete'));
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('posts.notScheduled');
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft:         { text: t('posts.draft'),        cls: 'badge-draft'     },
      scheduled:     { text: t('posts.scheduled'),    cls: 'badge-scheduled' },
      ready_to_post: { text: t('posts.ready'),        cls: 'badge-ready'     },
      posted:        { text: t('posts.posted'),       cls: 'badge-posted'    },
    };
    const badge = badges[status] || { text: status, cls: 'badge-default' };
    return <span className={`status-badge ${badge.cls}`}>{badge.text}</span>;
  };

  const filtered = posts.filter((post) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      post.caption.toLowerCase().includes(q) ||
      post.hashtags.toLowerCase().includes(q) ||
      post.topic.toLowerCase().includes(q);
    const matchPlatform = filterPlatform === 'all' || post.platform === filterPlatform;
    const matchStatus   = filterStatus   === 'all' || post.status   === filterStatus;
    return matchSearch && matchPlatform && matchStatus;
  });

  const hasActiveFilter = search || filterPlatform !== 'all' || filterStatus !== 'all';

  const clearFilters = () => {
    setSearch('');
    setFilterPlatform('all');
    setFilterStatus('all');
  };

  if (loading) return <div className="posts-container"><div className="loading">{t('posts.loading')}</div></div>;

  return (
    <div className="posts-container">
      <div className="posts-header">
        <h1>{t('posts.title')}</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/generate')} className="btn-create">{t('posts.createNew')}</button>
        </div>
      </div>

      {error && <div className="error-message">{t(error)}</div>}

      <div className="posts-filter-bar">
        <div className="posts-search-wrap">
          <svg className="posts-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="posts-search-input"
            placeholder={t('posts.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="posts-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
          )}
        </div>

        <select
          className="posts-filter-select"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
        >
          <option value="all">{t('posts.allPlatforms')}</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">Twitter</option>
        </select>

        <select
          className="posts-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">{t('posts.allStatuses')}</option>
          <option value="draft">{t('posts.draft')}</option>
          <option value="scheduled">{t('posts.scheduled')}</option>
          <option value="ready_to_post">{t('posts.readyToPost')}</option>
          <option value="posted">{t('posts.posted')}</option>
        </select>

        {hasActiveFilter && (
          <button className="posts-filter-clear" onClick={clearFilters}>
            {t('posts.clearFilters')}
          </button>
        )}
      </div>

      {hasActiveFilter && (
        <p className="posts-result-count">
          {t('posts.resultCount', { filtered: filtered.length, total: posts.length })}
        </p>
      )}

      {posts.length === 0 ? (
        <div className="empty-state">
          <p>{t('posts.noPosts')}</p>
          <button className="btn-create" onClick={() => navigate('/generate')}>{t('posts.createFirst')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>{t('posts.noMatch')}</p>
          <button className="btn-back" onClick={clearFilters}>{t('posts.clearFilters')}</button>
        </div>
      ) : (
        <div className="posts-grid">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/edit/${post.id}`)}
            >
              <div className="post-item-header">
                <div className="post-platform">
                  {PLATFORM_LABELS[post.platform] || post.platform}
                </div>
                {getStatusBadge(post.status)}
              </div>

              <div className="post-caption">
                {post.caption.length > 100 ? post.caption.substring(0, 100) + '...' : post.caption}
              </div>

              <div className="post-hashtags">{post.hashtags}</div>

              {post.image_prompt && (
                <div className="post-image-prompt">
                  {post.image_prompt.length > 80 ? post.image_prompt.substring(0, 80) + '...' : post.image_prompt}
                </div>
              )}

              <div className="post-meta">
                <span>📅 {formatDate(post.scheduled_time)}</span>
              </div>

              <div className="post-actions">
                <button
                  className="btn-edit"
                  onClick={(e) => { e.stopPropagation(); navigate(`/edit/${post.id}`); }}
                >
                  {t('posts.edit')}
                </button>
                <button className="btn-delete" onClick={(e) => handleDelete(e, post.id)}>
                  {t('posts.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PostsList;
