import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import SmmLogo from './SmmLogo';
import '../styles/Auth.css';

function CheckEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';
  const [resending, setResending] = useState(false);
  const [msg, setMsg] = useState('');

  const handleResend = async () => {
    setResending(true);
    setMsg('');
    try {
      await authAPI.resendVerification(email);
      setMsg('A new verification email has been sent.');
    } catch {
      setMsg('Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-container--centered">
      <div className="auth-right" style={{ width: '100%', maxWidth: 460 }}>
        <div className="auth-box" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <SmmLogo size={52} />
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginTop: 10 }}>SMM Assistant</span>
          </div>

          <div className="auth-box-header">
            <h2>Check your email</h2>
            <p>We sent a verification link to</p>
          </div>
          {email && (
            <p style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: 16 }}>{email}</p>
          )}
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Click the link in the email to activate your account.<br />
            Check your spam folder if you don't see it.
          </p>

          {msg && <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>{msg}</p>}

          <button className="btn-primary" onClick={handleResend} disabled={resending} style={{ marginBottom: 12 }}>
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>

          <p className="toggle-text" style={{ marginTop: 8 }}>
            <span className="toggle-link" onClick={() => navigate('/login')}>Back to login</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default CheckEmail;
