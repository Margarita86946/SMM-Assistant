import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Placeholder.css';

function Calendar() {
  const navigate = useNavigate();

  return (
    <div className="placeholder-container">
      <div className="placeholder-box">
        <h1>📅 Calendar View</h1>
        <p>This feature is coming soon!</p>
        <p className="placeholder-desc">
          Here you'll be able to see all your scheduled posts in a beautiful calendar layout and drag-and-drop to reschedule.
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-back-placeholder">
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default Calendar;