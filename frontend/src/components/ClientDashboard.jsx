import React, { useState, useEffect, useCallback } from 'react';
import { postsAPI, approvalAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import '../styles/ClientDashboard.css';

const PLATFORM_LABELS = {
  instagram: '📷 Instagram',
  linkedin:  '💼 LinkedIn',
  twitter:   '🐦 Twitter',
};

function ClientDashboard() {
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState({});
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Backend filters to client=request.user automatically, so no extra params needed.
      // We show all posts assigned to this client; they can filter by pending_approval locally.
      const res = await postsAPI.getAll({ page: 1, page_size: 100 });
      const results = res.data.results ?? res.data;
      setPosts(results.filter(p => p.status === 'pending_approval'));
    } catch {
      setError(t('approval.failedSubmit'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const formatDate = (dateString) => {
    if (!dateString) return t('dashboard.notScheduled');
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const handleApprove = async (id) => {
    setActing(s => ({ ...s, [id]: 'approving' }));
    try {
      await approvalAPI.approve(id);
      await load();
    } catch (err) {
      alert(err.message || 'Approval failed');
    } finally {
      setActing(s => ({ ...s, [id]: null }));
    }
  };

  const openReject = (id) => {
    setRejectFor(id);
    setRejectNote('');
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    const id = rejectFor;
    setActing(s => ({ ...s, [id]: 'rejecting' }));
    try {
      await approvalAPI.reject(id, rejectNote);
      setRejectFor(null);
      setRejectNote('');
      await load();
    } catch (err) {
      alert(err.message || 'Rejection failed');
    } finally {
      setActing(s => ({ ...s, [id]: null }));
    }
  };

  if (loading) return <div className="client-container"><div className="loading">{t('common.loading')}</div></div>;

  return (
    <div className="client-container">
      <div className="client-header">
        <h1>{t('approval.pendingTitle')}</h1>
        <p className="subtitle">{t('approval.pendingSubtitle')}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {posts.length === 0 ? (
        <div className="client-empty">
          <div className="client-empty-icon">✅</div>
          <h3>{t('approval.allCaughtUp')}</h3>
          <p>{t('approval.noPending')}</p>
        </div>
      ) : (
        <div className="client-grid">
          {posts.map(post => (
            <div key={post.id} className="client-card">
              {post.image_url && (
                <div className="client-card-img">
                  <img src={post.image_url} alt="" />
                </div>
              )}
              <div className="client-card-body">
                <div className="client-card-meta">
                  <span className="client-platform">{PLATFORM_LABELS[post.platform] || post.platform}</span>
                  <span className="client-date">{formatDate(post.scheduled_time)}</span>
                </div>
                <p className="client-caption">
                  {post.caption.length > 180 ? post.caption.slice(0, 180) + '…' : post.caption}
                </p>
                {post.hashtags && <p className="client-hashtags">{post.hashtags}</p>}

                {rejectFor === post.id ? (
                  <div className="client-reject-box">
                    <textarea
                      className="client-reject-textarea"
                      placeholder={t('approval.rejectReason')}
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                      rows={3}
                    />
                    <div className="client-reject-actions">
                      <button
                        className="client-btn-reject"
                        onClick={submitReject}
                        disabled={acting[post.id] === 'rejecting'}
                      >
                        {acting[post.id] === 'rejecting' ? t('approval.rejecting') : t('approval.confirmReject')}
                      </button>
                      <button className="client-btn-cancel" onClick={() => setRejectFor(null)}>
                        {t('calendar.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="client-actions">
                    <button
                      className="client-btn-approve"
                      onClick={() => handleApprove(post.id)}
                      disabled={acting[post.id] === 'approving'}
                    >
                      {acting[post.id] === 'approving' ? t('approval.approving') : t('approval.approve')}
                    </button>
                    <button className="client-btn-reject-open" onClick={() => openReject(post.id)}>
                      {t('approval.reject')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientDashboard;
