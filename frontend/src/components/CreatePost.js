import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Placeholder.css';

function CreatePost() {
  const navigate = useNavigate();

  return (
    <div className="placeholder-container">
      <div className="placeholder-box">
        <h1>✨ Create New Post</h1>
        <p>This feature is coming soon!</p>
        <p className="placeholder-desc">
          Here you'll be able to generate AI-powered captions, hashtags, and image prompts for your social media posts.
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-back-placeholder">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default CreatePost;