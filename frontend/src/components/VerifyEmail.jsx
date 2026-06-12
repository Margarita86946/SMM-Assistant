import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import SmmLogo from './SmmLogo';
import '../styles/Auth.css';

function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setError('Invalid verification link.'); return; }
    authAPI.verifyEmail(token)
      .then(res => {
        const data = res.data;
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        if (data.role) localStorage.setItem('role', data.role);
        if (data.expires_at) localStorage.setItem('token_expires_at', data.expires_at);
        window.dispatchEvent(new StorageEvent('storage', { key: 'role' }));
        setState('success');
        setTimeout(() => navigate(data.role === 'client' ? '/client' : '/dashboard'), 2000);
      })
      .catch(err => {
        setState('error');
        setError(err.message || 'This verification link is invalid or has expired.');
      });
  }, [token, navigate]);

  return (
    <div className="auth-container--centered">
      <div className="auth-right" style={{ width: '100%', maxWidth: 460 }}>
        <div className="auth-box" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <SmmLogo size={52} />
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginTop: 10 }}>SMM Assistant</span>
          </div>

          {state === 'verifying' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div className="auth-spinner" />
              </div>
              <div className="auth-box-header">
                <h2>Verifying your email…</h2>
                <p>Please wait a moment.</p>
              </div>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="auth-box-header">
                <h2>Email verified!</h2>
                <p>Your account is now active. Redirecting you to the dashboard…</p>
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="auth-box-header">
                <h2>Verification failed</h2>
                <p>{error}</p>
              </div>
              <button className="btn-primary" onClick={() => navigate('/login')}>Back to login</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;
