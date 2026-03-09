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
      background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: '72px', margin: '0', fontWeight: '800', letterSpacing: '-2px' }}>404</h1>
      <h2 style={{ fontSize: '28px', margin: '16px 0 8px', fontWeight: '700' }}>Page Not Found</h2>
      <p style={{ fontSize: '16px', marginBottom: '32px', opacity: 0.85 }}>
        The page you're looking for doesn't exist.
      </p>
      <button
        onClick={handleGoBack}
        style={{
          padding: '12px 28px',
          background: 'white',
          color: '#6366F1',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        {isLoggedIn ? '← Go to Dashboard' : '← Go to Login'}
      </button>
    </div>
  );
}

export default NotFound;