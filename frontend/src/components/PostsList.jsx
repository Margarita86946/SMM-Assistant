import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI, approvalAPI, instagramAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import '../styles/PostsList.css';

const PLATFORM_LABELS = {
  instagram: '📷 Instagram',
  linkedin:  '💼 LinkedIn',
  twitter:   '🐦 Twitter',
};

const STATUS_META = {
  draft:            { text: 'Draft',               cls: 'badge-draft'     },
  pending_approval: { text: 'Awaiting Approval',   cls: 'badge-pending'   },
  approved:         { text: 'Ready to Post',        cls: 'badge-approved'  },
  ready_to_post:    { text: 'Ready to Post',        cls: 'badge-approved'  },
  scheduled:        { text: 'Scheduled',            cls: 'badge-scheduled' },
  posted:           { text: 'Posted',               cls: 'badge-posted'    },
};

const PAGE_SIZE = 3;

function PostsList() {
  const [posts, setPosts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAllCount, setTotalAllCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(null);
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
      if (!srch && platform === 'all' && st === 'all') setTotalAllCount(count);
    } catch {
      setError(t('posts.failedLoad'));
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadPosts(page, debouncedSearch, filterPlatform, filterStatus);
  }, [page, debouncedSearch, filterPlatform, filterStatus, loadPosts]);

  const reload = () => loadPosts(page, debouncedSearch, filterPlatform, filterStatus);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm(t('posts.confirmDelete'))) return;
    try {
      await postsAPI.delete(id);
      const newTotal = totalCount - 1;
      const newTotalPages = Math.ceil(newTotal / PAGE_SIZE);
      const newPage = page > newTotalPages ? Math.max(1, newTotalPages) : page;
      if (newPage !== page) setPage(newPage);
      else reload();
    } catch {
      alert(t('posts.failedDelete'));
    }
  };

  const handleSubmitForApproval = async (e, id) => {
    e.stopPropagation();
    setSubmitting(id);
    try {
      await approvalAPI.submit(id);
      reload();
    } catch (err) {
      alert(err.message || 'Failed to submit for approval');
    } finally {
      setSubmitting(null);
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
      setPublishError(msg.toLowerCase().includes('no active instagram')
        ? t('instagram.publishNoAccount')
        : msg || t('instagram.publishFailed'));
      setTimeout(() => setPublishError(''), 6000);
    } finally {
      setPublishingId(null);
    }
  };

  const formatDate = (ds) => {
    if (!ds) return t('posts.notScheduled');
    return new Date(ds).toLocaleDateString(locale, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const hasActiveFilter = debouncedSearch || filterPlatform !== 'all' || filterStatus !== 'all';
  const clearFilters = () => { setSearch(''); setFilterPlatform('all'); setFilterStatus('all'); setPage(1); };
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

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
          {totalAllCount > 0 && <span className="posts-count-badge">{totalAllCount}</span>}
        </h1>
        <div className="header-actions">
          <button onClick={() => navigate('/generate')} className="btn-create">{t('posts.createNew')}</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {publishError && <div className="error-message">{publishError}</div>}
      {publishMsg && <div className="success-message">{publishMsg}</div>}

      <div className="posts-filter-bar">
        <div className="posts-search-wrap">
          <svg className="posts-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" className="posts-search-input"
            placeholder={t('posts.searchPlaceholder')} value={search}
            onChange={e => setSearch(e.target.value)} />
          {search && <button className="posts-search-clear" onClick={() => setSearch('')}>×</button>}
        </div>

        <select className="posts-filter-select" value={filterPlatform}
          onChange={e => { setFilterPlatform(e.target.value); setPage(1); }}>
          <option value="all">{t('posts.allPlatforms')}</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">Twitter</option>
        </select>

        <select className="posts-filter-select" value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="all">{t('posts.allStatuses')}</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Awaiting Approval</option>
          <option value="approved">Ready to Post</option>
          <option value="scheduled">{t('posts.scheduled')}</option>
          <option value="posted">{t('posts.posted')}</option>
        </select>

        {hasActiveFilter && (
          <button className="posts-filter-clear" onClick={clearFilters}>{t('posts.clearFilters')}</button>
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
            {posts.map(post => {
              const meta = STATUS_META[post.status] || { text: post.status, cls: 'badge-draft' };
              const isApproved = post.status === 'approved' || post.status === 'ready_to_post';
              const isRejectedDraft = post.status === 'draft' && post.approval_note;

              return (
                <div key={post.id} className={`post-item${isRejectedDraft ? ' post-item--rejected' : ''}`}>

                  <div className="post-item-header">
                    <div className="post-platform">{PLATFORM_LABELS[post.platform] || post.platform}</div>
                    <span className={`status-badge ${meta.cls}`}>{meta.text}</span>
                  </div>

                  {/* Rejection note callout — shown on draft posts that were previously rejected */}
                  {isRejectedDraft && (
                    <div className="post-rejection-callout">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                      <div>
                        <strong>Client rejected this post</strong>
                        {post.approval_note && <p>{post.approval_note}</p>}
                      </div>
                    </div>
                  )}

                  {/* Awaiting approval callout */}
                  {post.status === 'pending_approval' && (
                    <div className="post-pending-callout">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      Waiting for client to review
                    </div>
                  )}

                  {/* Approved callout */}
                  {isApproved && (
                    <div className="post-approved-callout">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Client approved — set a schedule to publish
                    </div>
                  )}

                  <div className="post-caption">
                    {post.caption.length > 100 ? post.caption.substring(0, 100) + '…' : post.caption}
                  </div>

                  {post.hashtags && <div className="post-hashtags">{post.hashtags}</div>}

                  <div className="post-meta">
                    <span>📅 {formatDate(post.scheduled_time)}</span>
                  </div>

                  <div className="post-actions">
                    {/* Edit — available on draft, approved, scheduled */}
                    {(isApproved || ['draft', 'scheduled'].includes(post.status)) && (
                      <button className="btn-edit"
                        onClick={e => { e.stopPropagation(); navigate(`/edit/${post.id}`); }}>
                        {isApproved ? '📅 Schedule' : t('posts.edit')}
                      </button>
                    )}

                    {/* Submit for Approval — only on draft */}
                    {post.status === 'draft' && (
                      <button className="btn-submit-approval"
                        onClick={e => handleSubmitForApproval(e, post.id)}
                        disabled={submitting === post.id}>
                        {submitting === post.id ? 'Submitting…' : 'Submit for Approval'}
                      </button>
                    )}

                    {/* Publish Now — only on approved or scheduled Instagram posts with image */}
                    {post.platform === 'instagram'
                      && (isApproved || post.status === 'scheduled')
                      && post.image_url && (
                      <button className="btn-publish-ig"
                        onClick={e => handlePublishNow(e, post)}
                        disabled={publishingId === post.id}>
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

                    {/* Delete — not on pending_approval or posted */}
                    {!['pending_approval', 'posted'].includes(post.status) && (
                      <button className="btn-delete" onClick={e => handleDelete(e, post.id)}>
                        {t('posts.delete')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {Array.from({ length: PAGE_SIZE - posts.length }).map((_, i) => (
              <div key={`ghost-${i}`} className="post-item post-item--ghost" aria-hidden="true" />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>←</button>
              {getPageNumbers().map((p, i) =>
                p === '…' ? (
                  <span key={`e-${i}`} className="pagination-ellipsis">…</span>
                ) : (
                  <button key={p}
                    className={`pagination-btn${page === p ? ' pagination-btn--active' : ''}`}
                    onClick={() => setPage(p)}>{p}</button>
                )
              )}
              <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>→</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PostsList;
