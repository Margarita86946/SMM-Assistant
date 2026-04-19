import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI, approvalAPI, instagramAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import '../styles/PostsList.css';

const PLATFORM_META = {
  instagram: { icon: '📷', label: 'Instagram' },
  linkedin:  { icon: '💼', label: 'LinkedIn'  },
  twitter:   { icon: '🐦', label: 'Twitter'   },
};

const PLATFORM_LABELS = {
  instagram: '📷 Instagram',
  linkedin:  '💼 LinkedIn',
  twitter:   '🐦 Twitter',
};

const STATUS_CLS = {
  draft:            'badge-draft',
  scheduled:        'badge-scheduled',
  ready_to_post:    'badge-ready',
  pending_approval: 'badge-pending',
  approved:         'badge-approved',
  rejected:         'badge-rejected',
  posted:           'badge-posted',
};

function PostViewModal({ post, onClose, onEdit, t, locale }) {
  const platform = PLATFORM_META[post.platform] || { icon: '📄', label: post.platform };
  const statusCls = STATUS_CLS[post.status] || 'badge-draft';
  const statusText = {
    draft: t('posts.draft'),
    scheduled: t('posts.scheduled'),
    ready_to_post: t('posts.ready'),
    posted: t('posts.posted'),
  }[post.status] || post.status;

  const formatFullDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString(locale, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="post-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="post-modal">
        <div className="post-modal-header">
          <div className="post-modal-platform">
            <span className="post-modal-platform-icon">{platform.icon}</span>
            <span className="post-modal-platform-label">{platform.label}</span>
            <span className={`status-badge ${statusCls}`}>{statusText}</span>
          </div>
          <button className="post-modal-close" onClick={onClose} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="post-modal-body">
          <div className="post-modal-section">
            <p className="post-modal-label">{t('calendar.labelScheduled')}</p>
            <p className="post-modal-value post-modal-date">
              {formatFullDate(post.scheduled_time) || t('posts.notScheduled')}
            </p>
          </div>

          <div className="post-modal-section">
            <p className="post-modal-label">{t('calendar.labelCaption')}</p>
            <p className="post-modal-value post-modal-caption">{post.caption}</p>
          </div>

          {post.hashtags && (
            <div className="post-modal-section">
              <p className="post-modal-label">{t('calendar.labelHashtags')}</p>
              <p className="post-modal-value post-modal-hashtags">{post.hashtags}</p>
            </div>
          )}

          {post.image_prompt && (
            <div className="post-modal-section">
              <p className="post-modal-label">{t('calendar.labelImagePrompt')}</p>
              <p className="post-modal-value post-modal-caption">{post.image_prompt}</p>
            </div>
          )}
        </div>

        <div className="post-modal-footer">
          <button className="post-modal-edit-btn" onClick={() => onEdit(post.id)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {t('calendar.editPost')}
          </button>
          <button className="post-modal-cancel-btn" onClick={onClose}>{t('calendar.close')}</button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 3;

function PostsList() {
  const [posts, setPosts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAllCount, setTotalAllCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [publishingId, setPublishingId] = useState(null);
  const [publishMsg, setPublishMsg] = useState('');
  const [publishError, setPublishError] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';

  const loadPosts = useCallback(async (pg, srch, platform, st) => {
    try {
      setLoading(true);
      const params = { page: pg };
      if (srch) params.search = srch;
      if (platform !== 'all') params.platform = platform;
      if (st !== 'all') params.status = st;
      const response = await postsAPI.getAll(params);
      const count = response.data.count ?? 0;
      setPosts(response.data.results ?? response.data);
      setTotalCount(count);
      if (!srch && platform === 'all' && st === 'all') {
        setTotalAllCount(count);
      }
      setLoading(false);
      setInitialLoad(false);
    } catch {
      setError('posts.failedLoad');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadPosts(page, debouncedSearch, filterPlatform, filterStatus);
  }, [page, debouncedSearch, filterPlatform, filterStatus, loadPosts]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm(t('posts.confirmDelete'))) {
      try {
        await postsAPI.delete(id);
        const newTotal = totalCount - 1;
        const newTotalPages = Math.ceil(newTotal / PAGE_SIZE);
        const newPage = page > newTotalPages ? Math.max(1, newTotalPages) : page;
        if (newPage !== page) {
          setPage(newPage);
        } else {
          loadPosts(page, debouncedSearch, filterPlatform, filterStatus);
        }
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
      draft:            { text: t('posts.draft'),        cls: 'badge-draft'     },
      scheduled:        { text: t('posts.scheduled'),    cls: 'badge-scheduled' },
      ready_to_post:    { text: t('posts.ready'),        cls: 'badge-ready'     },
      pending_approval: { text: 'Pending Approval',      cls: 'badge-pending'   },
      approved:         { text: 'Approved',              cls: 'badge-approved'  },
      rejected:         { text: 'Rejected',              cls: 'badge-rejected'  },
      posted:           { text: t('posts.posted'),       cls: 'badge-posted'    },
    };
    const badge = badges[status] || { text: status, cls: 'badge-default' };
    return <span className={`status-badge ${badge.cls}`}>{badge.text}</span>;
  };

  const handleSubmitForApproval = async (e, id) => {
    e.stopPropagation();
    try {
      await approvalAPI.submit(id);
      loadPosts(page, debouncedSearch, filterPlatform, filterStatus);
    } catch (err) {
      alert(err.message || 'Failed to submit for approval');
    }
  };

  const handlePublishNow = async (e, post) => {
    e.stopPropagation();
    setPublishError('');
    setPublishMsg('');
    setPublishingId(post.id);
    try {
      await instagramAPI.publishNow(post.id);
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: 'posted' } : p));
      setPublishMsg(t('instagram.publishSuccess'));
      setTimeout(() => setPublishMsg(''), 4000);
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('no active instagram')) {
        setPublishError(t('instagram.publishNoAccount'));
      } else {
        setPublishError(msg || t('instagram.publishFailed'));
      }
      setTimeout(() => setPublishError(''), 5000);
    } finally {
      setPublishingId(null);
    }
  };

  const hasActiveFilter = debouncedSearch || filterPlatform !== 'all' || filterStatus !== 'all';

  const clearFilters = () => {
    setSearch('');
    setFilterPlatform('all');
    setFilterStatus('all');
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearchChange = (val) => { setSearch(val); };
  const handlePlatformChange = (val) => { setFilterPlatform(val); setPage(1); };
  const handleStatusChange = (val) => { setFilterStatus(val); setPage(1); };

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '…', totalPages];
    if (page >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', page - 1, page, page + 1, '…', totalPages];
  };

  if (loading && initialLoad) return <div className="posts-container"><div className="loading">{t('posts.loading')}</div></div>;

  return (
    <div className="posts-container">
      <div className="posts-header">
        <h1>
          {t('posts.title')}
          {totalAllCount > 0 && (
            <span className="posts-count-badge">{totalAllCount}</span>
          )}
        </h1>
        <div className="header-actions">
          <button onClick={() => navigate('/generate')} className="btn-create">{t('posts.createNew')}</button>
        </div>
      </div>

      {error && <div className="error-message">{t(error)}</div>}
      {publishError && <div className="error-message">{publishError}</div>}
      {publishMsg && <div className="success-message">{publishMsg}</div>}

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
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {search && (
            <button className="posts-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
          )}
        </div>

        <select
          className="posts-filter-select"
          value={filterPlatform}
          onChange={(e) => handlePlatformChange(e.target.value)}
        >
          <option value="all">{t('posts.allPlatforms')}</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">Twitter</option>
        </select>

        <select
          className="posts-filter-select"
          value={filterStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
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

      {hasActiveFilter && totalCount > 0 && (
        <p className="posts-result-count">
          {t('posts.resultCount', { filtered: totalCount, total: totalAllCount })}
        </p>
      )}

      {!loading && totalCount === 0 && !hasActiveFilter ? (
        <div className="empty-state">
          <p>{t('posts.noPosts')}</p>
          <button className="btn-create" onClick={() => navigate('/generate')}>{t('posts.createFirst')}</button>
        </div>
      ) : !loading && totalCount === 0 && hasActiveFilter ? (
        <div className="empty-state">
          <p>{t('posts.noMatch')}</p>
          <button className="btn-back" onClick={clearFilters}>{t('posts.clearFilters')}</button>
        </div>
      ) : (
        <div className="posts-content">
          <div className="posts-grid">
            {posts.map((post) => (
              <div
                key={post.id}
                className="post-item"
                onClick={() => setSelectedPost(post)}
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

                {post.status === 'rejected' && post.approval_note && (
                  <p className="post-rejection-note">✗ {post.approval_note}</p>
                )}

                <div className="post-actions">
                  <button
                    className="btn-edit"
                    onClick={(e) => { e.stopPropagation(); navigate(`/edit/${post.id}`); }}
                  >
                    {t('posts.edit')}
                  </button>
                  {(post.status === 'draft' || post.status === 'ready_to_post') && (
                    <button className="btn-submit-approval" onClick={(e) => handleSubmitForApproval(e, post.id)}>
                      Submit for Approval
                    </button>
                  )}
                  {post.platform === 'instagram'
                    && post.status !== 'posted'
                    && post.image_url && (
                    <button
                      className="btn-publish-ig"
                      onClick={(e) => handlePublishNow(e, post)}
                      disabled={publishingId === post.id}
                    >
                      {publishingId === post.id ? (
                        <><span className="btn-publish-ig-spinner" /> {t('instagram.publishing')}</>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                          </svg>
                          {t('instagram.publishBtn')}
                        </>
                      )}
                    </button>
                  )}
                  <button className="btn-delete" onClick={(e) => handleDelete(e, post.id)}>
                    {t('posts.delete')}
                  </button>
                </div>
              </div>
            ))}
            {Array.from({ length: PAGE_SIZE - posts.length }).map((_, i) => (
              <div key={`ghost-${i}`} className="post-item post-item--ghost" aria-hidden="true" />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 1}
              >
                ←
              </button>

              {getPageNumbers().map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    className={`pagination-btn${page === p ? ' pagination-btn--active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                )
              )}

              <button
                className="pagination-btn"
                onClick={() => setPage(p => p + 1)}
                disabled={page === totalPages}
              >
                →
              </button>
            </div>
          )}
        </div>
      )}
      {selectedPost && (
        <PostViewModal
          post={selectedPost}
          t={t}
          locale={locale}
          onClose={() => setSelectedPost(null)}
          onEdit={(id) => { setSelectedPost(null); navigate(`/edit/${id}`); }}
        />
      )}
    </div>
  );
}

export default PostsList;
