import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, postsAPI } from '../services/api';
import '../styles/Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState({
    total_posts: 0,
    posts_this_week: 0,
    draft_posts: 0,
    scheduled_posts: 0,
  });
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [statsResponse, postsResponse] = await Promise.all([
        dashboardAPI.getStats(),
        postsAPI.getAll(),
      ]);

      setStats(statsResponse.data);
      setRecentPosts(postsResponse.data.slice(0, 5));

    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { text: 'Draft', class: 'badge-draft' },
      scheduled: { text: 'Scheduled', class: 'badge-scheduled' },
      ready_to_post: { text: 'Ready', class: 'badge-ready' },
      posted: { text: 'Posted', class: 'badge-posted' },
    };
    const badge = badges[status] || { text: status, class: 'badge-default' };
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">

      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {username}! 👋</h1>
          <p className="subtitle">Here's what's happening with your posts</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-info">
            <h3>{stats.total_posts}</h3>
            <p>Total Posts</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-info">
            <h3>{stats.posts_this_week}</h3>
            <p>This Week</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✏️</div>
          <div className="stat-info">
            <h3>{stats.draft_posts}</h3>
            <p>Drafts</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-info">
            <h3>{stats.scheduled_posts}</h3>
            <p>Scheduled</p>
          </div>
        </div>
      </div>

      <div className="recent-posts-section">
        <div className="section-header">
          <h2>Recent Posts</h2>
          <button className="btn-view-all" onClick={() => navigate('/posts')}>
            View All →
          </button>
        </div>

        {recentPosts.length === 0 ? (
          <div className="empty-state">
            <p>📭 No posts yet</p>
            <button className="btn-create" onClick={() => navigate('/create')}>
              Create Your First Post
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
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="quick-actions">
        <h2>Quick Actions</h2>
        <div className="actions-grid">
          <button className="action-btn" onClick={() => navigate('/create')}>
            <span className="action-icon">✨</span>
            <span>Create New Post</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/posts')}>
            <span className="action-icon">📋</span>
            <span>View All Posts</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/calendar')}>
            <span className="action-icon">📅</span>
            <span>Calendar View</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/generate')}>
            <span className="action-icon">🤖</span>
            <span>AI Generate</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;