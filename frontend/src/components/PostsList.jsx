import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI, approvalAPI, instagramAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import { useActiveClient } from '../context/ActiveClientContext';
import { FiUser, FiSearch, FiAlertCircle, FiClock, FiCheck, FiTrash2, FiCalendar, FiX } from 'react-icons/fi';
import { FaInstagram, FaLinkedin, FaTwitter } from 'react-icons/fa';
import '../styles/PostsList.css';

const PLATFORM_LABELS = {
  instagram: { icon: <FaInstagram />, text: 'Instagram' },
  linkedin:  { icon: <FaLinkedin />,  text: 'LinkedIn' },
  twitter:   { icon: <FaTwitter />,   text: 'Twitter' },
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
  const [submitError, setSubmitError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [publishingId, setPublishingId] = useState(null);
  const [publishMsg, setPublishMsg] = useState('');
  const [publishError, setPublishError] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkScheduleDate, setBulkScheduleDate] = useState('');
  const [bulkScheduleTime, setBulkScheduleTime] = useState('09:00');
  const [showBulkSchedule, setShowBulkSchedule] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';
  const { activeClientId, activeClient } = useActiveClient();

  const loadPosts = useCallback(async (pg, srch, platform, st) => {
    try {
      setLoading(true);
      const params = { page: pg };
      if (srch) params.search = srch;
      if (platform !== 'all') params.platform = platform;
      if (st !== 'all') params.status = st;
      if (activeClientId) params.client_id = activeClientId;
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
  }, [t, activeClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when the active client changes
  useEffect(() => { setPage(1); }, [activeClientId]);

  useEffect(() => {
    loadPosts(page, debouncedSearch, filterPlatform, filterStatus);
  }, [page, debouncedSearch, filterPlatform, filterStatus, loadPosts]);

  const reload = () => loadPosts(page, debouncedSearch, filterPlatform, filterStatus);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm(t('posts.confirmDelete'))) return;
    setDeleteError('');
    try {
      await postsAPI.delete(id);
      const newTotal = totalCount - 1;
      const newTotalPages = Math.ceil(newTotal / PAGE_SIZE);
      const newPage = page > newTotalPages ? Math.max(1, newTotalPages) : page;
      if (newPage !== page) setPage(newPage);
      else reload();
    } catch {
      setDeleteError(t('posts.failedDelete'));
      setTimeout(() => setDeleteError(''), 5000);
    }
  };

  const handleSubmitForApproval = async (e, id) => {
    e.stopPropagation();
    setSubmitting(id);
    setSubmitError('');
    try {
      await approvalAPI.submit(id);
      reload();
    } catch (err) {
      setSubmitError(err.message || t('approval.failedSubmit'));
      setTimeout(() => setSubmitError(''), 5000);
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
      const isNoAccount = msg === 'No active Instagram account connected';
      setPublishError(isNoAccount ? t('instagram.publishNoAccount') : (msg || t('instagram.publishFailed')));
      setTimeout(() => setPublishError(''), 6000);
    } finally {
      setPublishingId(null);
    }
  };

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    const selectableIds = posts
      .filter(p => !['pending_approval', 'posted'].includes(p.status))
      .map(p => p.id);
    const allSelected = selectableIds.every(id => selected.has(id));
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} post(s)?`)) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => postsAPI.delete(id)));
      setSelected(new Set());
      reload();
    } catch {
      setDeleteError('Failed to delete some posts.');
      setTimeout(() => setDeleteError(''), 4000);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkSchedule = async () => {
    if (!bulkScheduleDate || !bulkScheduleTime) return;
    const [yr, mo, dy] = bulkScheduleDate.split('-').map(Number);
    const [hr, mn] = bulkScheduleTime.split(':').map(Number);
    const iso = new Date(yr, mo - 1, dy, hr, mn, 0).toISOString();
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map(id => postsAPI.update(id, { scheduled_time: iso, status: 'scheduled' })));
      setSelected(new Set());
      setShowBulkSchedule(false);
      setBulkScheduleDate('');
      reload();
    } catch {
      setDeleteError('Failed to schedule some posts.');
      setTimeout(() => setDeleteError(''), 4000);
    } finally {
      setBulkLoading(false);
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
          <button onClick={() => navigate('/create')} className="btn-create btn-create--outline">{t('posts.createManual')}</button>
          <button onClick={() => navigate('/generate')} className="btn-create">{t('posts.createNew')}</button>
        </div>
      </div>

      {activeClient && (
        <div className="posts-client-banner">
          <FiUser />
          {t('posts.filteredByClient', { name: [activeClient.first_name, activeClient.last_name].filter(Boolean).join(' ') || activeClient.username })}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      {deleteError && <div className="error-message">{deleteError}</div>}
      {submitError && <div className="error-message">{submitError}</div>}
      {publishError && <div className="error-message">{publishError}</div>}
      {publishMsg && <div className="success-message">{publishMsg}</div>}

      <div className="posts-filter-bar">
        <label className="posts-select-all">
          <input
            type="checkbox"
            checked={posts.filter(p => !['pending_approval','posted'].includes(p.status)).length > 0 &&
              posts.filter(p => !['pending_approval','posted'].includes(p.status)).every(p => selected.has(p.id))}
            onChange={toggleSelectAll}
          />
          <span>Select all</span>
        </label>
        <div className="posts-search-wrap">
          <FiSearch className="posts-search-icon" />
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

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-bar-count">{selected.size} selected</span>
          <div className="bulk-bar-actions">
            {showBulkSchedule ? (
              <>
                <input type="date" className="bulk-date-input" value={bulkScheduleDate}
                  min={new Date().toISOString().slice(0,10)}
                  onChange={e => setBulkScheduleDate(e.target.value)} />
                <input type="time" className="bulk-date-input" value={bulkScheduleTime}
                  onChange={e => setBulkScheduleTime(e.target.value)} />
                <button className="bulk-btn bulk-btn--primary" onClick={handleBulkSchedule}
                  disabled={bulkLoading || !bulkScheduleDate}>
                  <FiCheck /> Confirm
                </button>
                <button className="bulk-btn" onClick={() => setShowBulkSchedule(false)}>
                  <FiX /> Cancel
                </button>
              </>
            ) : (
              <>
                <button className="bulk-btn" onClick={() => setShowBulkSchedule(true)} disabled={bulkLoading}>
                  <FiCalendar /> Schedule
                </button>
                <button className="bulk-btn bulk-btn--danger" onClick={handleBulkDelete} disabled={bulkLoading}>
                  <FiTrash2 /> Delete
                </button>
              </>
            )}
          </div>
          <button className="bulk-bar-close" onClick={() => { setSelected(new Set()); setShowBulkSchedule(false); }}>
            <FiX />
          </button>
        </div>
      )}

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
              const isSelectable = !['pending_approval', 'posted'].includes(post.status);
              const isSelected = selected.has(post.id);

              return (
                <div key={post.id} className={`post-item${isRejectedDraft ? ' post-item--rejected' : ''}${isSelected ? ' post-item--selected' : ''}`}>

                  <div className="post-item-header">
                    <div className={`post-platform${post.platform ? ` post-platform--${post.platform}` : ''}`}>
                      {PLATFORM_LABELS[post.platform]
                        ? <><span className="post-platform-icon">{PLATFORM_LABELS[post.platform].icon}</span><span className="post-platform-text">{PLATFORM_LABELS[post.platform].text}</span></>
                        : post.platform}
                    </div>
                    <div className="post-item-header-right">
                      <span className={`status-badge ${meta.cls}`}>{meta.text}</span>
                      {isSelectable && (
                        <label className="post-checkbox" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(post.id)} />
                        </label>
                      )}
                    </div>
                  </div>

                  {!activeClientId && post.client_username && (
                    <div className="post-client-tag">
                      <FiUser />
                      {post.client_first_name || post.client_last_name
                        ? [post.client_first_name, post.client_last_name].filter(Boolean).join(' ')
                        : post.client_username}
                    </div>
                  )}

                  {/* Rejection note callout — shown on draft posts that were previously rejected */}
                  {isRejectedDraft && (
                    <div className="post-rejection-callout">
                      <FiAlertCircle />
                      <div>
                        <strong>{t('approval.clientRejected')}</strong>
                        {post.approval_note && <p>{post.approval_note}</p>}
                      </div>
                    </div>
                  )}

                  {/* Awaiting approval callout */}
                  {post.status === 'pending_approval' && (
                    <div className="post-pending-callout">
                      <FiClock />
                      {t('approval.waitingReview')}
                    </div>
                  )}

                  {/* Approved callout */}
                  {isApproved && (
                    <div className="post-approved-callout">
                      <FiCheck />
                      {t('approval.clientApproved')}
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
                        {isApproved ? t('approval.scheduleBtn') : t('posts.edit')}
                      </button>
                    )}

                    {/* Submit for Approval — only on draft */}
                    {post.status === 'draft' && (
                      <button className="btn-submit-approval"
                        onClick={e => handleSubmitForApproval(e, post.id)}
                        disabled={submitting === post.id}>
                        {submitting === post.id ? t('approval.submitting') : t('approval.submitBtn')}
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
                            <FaInstagram />
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
