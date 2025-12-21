import React from 'react';
import { useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();
  const isLoggedIn = localStorage.getItem('token');

  const handleGoBack = () => {
    if (isLoggedIn) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '72px', margin: '0' }}>404</h1>
      <h2 style={{ fontSize: '32px', margin: '20px 0' }}>Page Not Found</h2>
      <p style={{ fontSize: '18px', marginBottom: '30px' }}>
        The page you're looking for doesn't exist.
      </p>
      <button
        onClick={handleGoBack}
        style={{
          padding: '12px 24px',
          background: 'white',
          color: '#667eea',
          border: 'none',
          borderRadius: '6px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
        onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
      >
        {isLoggedIn ? '← Go to Dashboard' : '← Go to Login'}
      </button>
    </div>
  );
}

export default NotFound;