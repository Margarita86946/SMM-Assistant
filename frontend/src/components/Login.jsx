import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/Auth.css';

function Login({ isLoginMode }) {
  const [isLogin, setIsLogin] = useState(isLoginMode);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setIsLogin(isLoginMode);
  }, [isLoginMode]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await authAPI.login({
          username: formData.username,
          password: formData.password,
        });
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('username', formData.username);
        navigate('/dashboard');
      } else {
        if (formData.password !== formData.password2) {
          setError(t('auth.passwordMismatch'));
          setLoading(false);
          return;
        }
        await authAPI.register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        });
        const loginResponse = await authAPI.login({
          username: formData.username,
          password: formData.password,
        });
        localStorage.setItem('token', loginResponse.data.token);
        localStorage.setItem('username', formData.username);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setError('');
    setFormData({ username: '', email: '', password: '', password2: '' });
    navigate(isLogin ? '/register' : '/login');
  };

  return (
    <div className="auth-container">
      <div className="auth-left">
        <div className="auth-brand-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
          </svg>
        </div>
        <h1>{t('auth.tagline')}</h1>
        <p>{t('auth.taglineDesc')}</p>

        <div className="auth-features">
          <div className="auth-feature">
            <div className="auth-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <div className="auth-feature-text">
              <strong>{t('auth.feature1Title')}</strong>
              <span>{t('auth.feature1Desc')}</span>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="auth-feature-text">
              <strong>{t('auth.feature2Title')}</strong>
              <span>{t('auth.feature2Desc')}</span>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
            </div>
            <div className="auth-feature-text">
              <strong>{t('auth.feature3Title')}</strong>
              <span>{t('auth.feature3Desc')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box">
          <div className="auth-box-header">
            <h2>{isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}</h2>
            <p>{isLogin ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}</p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{t('auth.username')}</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder={t('auth.usernamePlaceholder')}
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>{t('auth.email')}</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
            )}

            <div className="form-group">
              <label>{t('auth.password')}</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder={t('auth.passwordPlaceholder')}
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>{t('auth.confirmPassword')}</label>
                <input
                  type="password"
                  name="password2"
                  value={formData.password2}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                />
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? t('auth.pleaseWait') : (isLogin ? t('auth.signIn') : t('auth.createAccount'))}
            </button>
          </form>

          <p className="toggle-text">
            {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
            <span onClick={toggleMode} className="toggle-link">
              {isLogin ? t('auth.registerHere') : t('auth.signIn')}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
