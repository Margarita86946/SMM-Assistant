import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import SmmLogo from './SmmLogo';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import '../styles/Auth.css';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== password2) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container--centered">
      <div className="auth-right" style={{ width: '100%', maxWidth: 460 }}>
        <div className="auth-box">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <SmmLogo size={52} />
            <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', marginTop: 10 }}>SMM Assistant</span>
          </div>

          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div className="auth-box-header">
                <h2>Password reset!</h2>
                <p>Your password has been updated. Please log in with your new password.</p>
              </div>
              <button className="btn-primary" onClick={() => navigate('/login')}>Go to login</button>
            </div>
          ) : (
            <>
              <div className="auth-box-header">
                <h2>Reset password</h2>
                <p>Enter your new password below.</p>
              </div>

              {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>New password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                    />
                    <button type="button" className="btn-password-toggle" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                      {showPw ? <FiEyeOff /> : <FiEye />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm new password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
