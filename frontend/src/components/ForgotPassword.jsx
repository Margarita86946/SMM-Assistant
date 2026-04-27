import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import SmmLogo from './SmmLogo';
import '../styles/Auth.css';

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim().toLowerCase());
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container--centered">
      <div className="auth-right" style={{ width: '100%', maxWidth: 460 }}>
        <div className="auth-box">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <SmmLogo size={52} style={{ marginBottom: 12 }} />
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginTop: 10 }}>SMM Assistant</span>
          </div>

          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div className="auth-box-header">
                <h2>Check your email</h2>
                <p>If <strong>{email}</strong> is registered, you'll receive a reset link shortly. Check your spam folder too.</p>
              </div>
              <button className="btn-primary" onClick={() => navigate('/login')}>Back to login</button>
            </div>
          ) : (
            <>
              <div className="auth-box-header">
                <h2>Forgot password?</h2>
                <p>Enter your email and we'll send you a reset link.</p>
              </div>

              {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="toggle-text" style={{ marginTop: 20 }}>
                Remember your password?{' '}
                <span className="toggle-link" onClick={() => navigate('/login')}>Sign in</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
