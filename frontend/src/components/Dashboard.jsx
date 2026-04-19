import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import '../styles/Dashboard.css';

const STATUS_COLORS = {
  draft: '#F59E0B',
  scheduled: '#3B82F6',
  pending_approval: '#8B5CF6',
  approved: '#10B981',
  posted: '#6B7280',
  rejected: '#EF4444',
};

const STATUS_LABELS = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  pending_approval: 'Pending',
  approved: 'Approved',
  posted: 'Posted',
  rejected: 'Rejected',
};

function PostDetailModal({ post, onClose, t, formatDate, getStatusBadge }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="post-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="post-modal">
        <div className="post-modal-header">
          <h3>{t('dashboard.postDetails')}</h3>
          <button className="post-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="post-modal-body">
          {post.image_url && (
            <div className="post-modal-image">
              <img src={post.image_url} alt="Post visual" />
            </div>
          )}
          <div className="post-modal-meta">
            <span className="post-platform">
              {post.platform === 'instagram' && '📷 Instagram'}
              {post.platform === 'linkedin' && '💼 LinkedIn'}
              {post.platform === 'twitter' && '🐦 Twitter'}
            </span>
            {getStatusBadge(post.status)}
          </div>
          {post.topic && (
            <div className="post-modal-field">
              <span className="post-modal-label">{t('dashboard.topic')}</span>
              <p>{post.topic}</p>
            </div>
          )}
          <div className="post-modal-field">
            <span className="post-modal-label">{t('dashboard.caption')}</span>
            <p>{post.caption}</p>
          </div>
          {post.hashtags && (
            <div className="post-modal-field">
              <span className="post-modal-label">{t('dashboard.hashtags')}</span>
              <p className="post-modal-hashtags">{post.hashtags}</p>
            </div>
          )}
          <div className="post-modal-field">
            <span className="post-modal-label">{t('dashboard.scheduledTime')}</span>
            <p>{formatDate(post.scheduled_time)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({
    total_posts: 0,
    posts_this_week: 0,
    draft_posts: 0,
    scheduled_posts: 0,
    pending_approval_posts: 0,
    approved_posts: 0,
    posted_posts: 0,
    rejected_posts: 0,
    most_used_hashtags: [],
  });
  const [activity, setActivity] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';
  const username = localStorage.getItem('username');

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [statsResponse, postsResponse, activityResponse] = await Promise.all([
        dashboardAPI.getStats(),
        postsAPI.getAll(),
        dashboardAPI.getActivity(),
      ]);

      setStats(statsResponse.data);
      const allPosts = postsResponse.data.results ?? postsResponse.data;
      setRecentPosts(allPosts.slice(0, 5));
      setActivity(activityResponse.data);

    } catch {
      setError('dashboard.failedLoad');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatDate = (dateString) => {
    if (!dateString) return t('dashboard.notScheduled');
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { text: t('posts.draft'), class: 'badge-draft' },
      scheduled: { text: t('posts.scheduled'), class: 'badge-scheduled' },
      ready_to_post: { text: t('posts.ready'), class: 'badge-ready' },
      pending_approval: { text: 'Pending', class: 'badge-pending' },
      approved: { text: 'Approved', class: 'badge-approved' },
      rejected: { text: 'Rejected', class: 'badge-rejected' },
      posted: { text: t('posts.posted'), class: 'badge-posted' },
    };
    const badge = badges[status] || { text: status, class: 'badge-default' };
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  const pieData = [
    { key: 'draft', value: stats.draft_posts || 0 },
    { key: 'scheduled', value: stats.scheduled_posts || 0 },
    { key: 'pending_approval', value: stats.pending_approval_posts || 0 },
    { key: 'approved', value: stats.approved_posts || 0 },
    { key: 'posted', value: stats.posted_posts || 0 },
  ].filter(d => d.value > 0).map(d => ({ name: STATUS_LABELS[d.key], value: d.value, key: d.key }));

  const activityData = activity.map(d => ({
    date: new Date(d.date).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
    count: d.count,
  }));

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">{t('dashboard.loading')}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          t={t}
          formatDate={formatDate}
          getStatusBadge={getStatusBadge}
        />
      )}

      <div className="dashboard-header">
        <div>
          <h1>{t('dashboard.welcome', { username })}</h1>
          <p className="subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-message">{t(error)}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-info">
            <h3>{stats.total_posts}</h3>
            <p>{t('dashboard.totalPosts')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-info">
            <h3>{stats.posts_this_week}</h3>
            <p>{t('dashboard.thisWeek')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✏️</div>
          <div className="stat-info">
            <h3>{stats.draft_posts}</h3>
            <p>{t('dashboard.drafts')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-info">
            <h3>{stats.scheduled_posts}</h3>
            <p>{t('dashboard.scheduled')}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-charts-grid">
        <div className="dashboard-chart-card">
          <h2 className="dashboard-chart-title">Posts by Status</h2>
          {pieData.length === 0 ? (
            <p className="hashtag-empty">No posts yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map(entry => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={32} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="dashboard-chart-card">
          <h2 className="dashboard-chart-title">Posts Created (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="recent-posts-section hashtag-stats-section">
        <div className="section-header">
          <h2>{t('dashboard.topHashtags')}</h2>
        </div>
        {stats.most_used_hashtags.length === 0 ? (
          <p className="hashtag-empty">{t('dashboard.noHashtags')}</p>
        ) : (
          <div className="hashtag-stats-list">
            {stats.most_used_hashtags.map((item) => (
              <div key={item.tag} className="hashtag-stat-item">
                <span className="hashtag-tag">{item.tag}</span>
                <span className="hashtag-count">×{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="recent-posts-section">
        <div className="section-header">
          <h2>{t('dashboard.recentPosts')}</h2>
          <button className="btn-view-all" onClick={() => navigate('/posts')}>
            {t('dashboard.viewAll')}
          </button>
        </div>

        {recentPosts.length === 0 ? (
          <div className="empty-state">
            <p>{t('dashboard.noPosts')}</p>
            <button className="btn-create" onClick={() => navigate('/create')}>
              {t('dashboard.createFirst')}
            </button>
          </div>
        ) : (
          <div className="posts-list">
            {recentPosts.map((post) => (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <h3>
                    {post.caption.length > 50
                      ? post.caption.substring(0, 50) + '...'
                      : post.caption}
                  </h3>
                  {getStatusBadge(post.status)}
                </div>
                <div className="post-meta">
                  <span className="post-platform">
                    {post.platform === 'instagram' && '📷 Instagram'}
                    {post.platform === 'linkedin' && '💼 LinkedIn'}
                    {post.platform === 'twitter' && '🐦 Twitter'}
                  </span>
                  <span className="post-date">{formatDate(post.scheduled_time)}</span>
                </div>
                <div className="post-hashtags">
                  {post.hashtags.length > 60
                    ? post.hashtags.substring(0, 60) + '...'
                    : post.hashtags}
                </div>
                <button className="btn-view-details" onClick={() => setSelectedPost(post)}>
                  {t('dashboard.viewDetails')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default Dashboard;
