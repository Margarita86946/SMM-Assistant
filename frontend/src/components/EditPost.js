import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/Placeholder.css';

function EditPost() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="placeholder-container">
      <div className="placeholder-box">
        <h1>✏️ Edit Post #{id}</h1>
        <p>This feature is coming soon!</p>
        <p className="placeholder-desc">
          Here you'll be able to edit your post's caption, hashtags, scheduled time, and status.
        </p>
        <button onClick={() => navigate('/posts')} className="btn-back-placeholder">
          ← Back to Posts
        </button>
      </div>
    </div>
  );
}

export default EditPost;