import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../services/api';
import '../styles/PostsList.css';

function PostsList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const response = await postsAPI.getAll();
      setPosts(response.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading posts:', err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/');
      } else {
        setError('Failed to load posts');
      }
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await postsAPI.delete(id);
        setPosts(posts.filter(post => post.id !== id));
      } catch (err) {
        alert('Failed to delete post');
      }
    }
  };

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
      <div className="posts-container">
        <div className="loading">Loading posts...</div>
      </div>
    );
  }

  return (
    <div className="posts-container">
      <div className="posts-header">
        <h1>All Posts</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/create')} className="btn-create">
            ✨ Create New Post
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-back">
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {posts.length === 0 ? (
        <div className="empty-state">
          <p>📭 No posts yet</p>
          <button className="btn-create" onClick={() => navigate('/create')}>
            Create Your First Post
          </button>
        </div>
      ) : (
        <div className="posts-grid">
          {posts.map((post) => (
            <div key={post.id} className="post-item">
              <div className="post-item-header">
                <div className="post-platform">
                  {post.platform === 'instagram' && '📷 Instagram'}
                  {post.platform === 'linkedin' && '💼 LinkedIn'}
                  {post.platform === 'twitter' && '🐦 Twitter'}
                </div>
                {getStatusBadge(post.status)}
              </div>

              <div className="post-caption">
                {post.caption.length > 100
                  ? post.caption.substring(0, 100) + '...'
                  : post.caption}
              </div>

              <div className="post-hashtags">{post.hashtags}</div>

              <div className="post-meta">
                <span>📅 {formatDate(post.scheduled_time)}</span>
              </div>

              <div className="post-actions">
                <button className="btn-edit" onClick={() => navigate(`/edit/${post.id}`)}>
                  ✏️ Edit
                </button>
                <button className="btn-delete" onClick={() => handleDelete(post.id)}>
                  🗑️ Delete
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