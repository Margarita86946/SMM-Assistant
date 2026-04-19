import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/Auth.css';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

function Login({ isLoginMode }) {
  const [isLogin, setIsLogin] = useState(isLoginMode);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password2: '',
    role: 'specialist',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    setIsLogin(isLoginMode);
    sessionStorage.setItem('lastPublicPath', isLoginMode ? '/login' : '/register');
  }, [isLoginMode]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
        if (response.data.role) localStorage.setItem('role', response.data.role);
        if (response.data.expires_at) {
          localStorage.setItem('token_expires_at', response.data.expires_at);
        }
        navigate(response.data.role === 'client' ? '/client' : '/dashboard');
      } else {
        if (formData.password !== formData.password2) {
          setError(t('auth.passwordMismatch'));
          setLoading(false);
          return;
        }
        await authAPI.register({
          username: formData.username,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
          role: formData.role,
        });
        const loginResponse = await authAPI.login({
          username: formData.username,
          password: formData.password,
        });
        localStorage.setItem('token', loginResponse.data.token);
        localStorage.setItem('username', formData.username);
        if (loginResponse.data.role) localStorage.setItem('role', loginResponse.data.role);
        if (loginResponse.data.expires_at) {
          localStorage.setItem('token_expires_at', loginResponse.data.expires_at);
        }
        navigate(loginResponse.data.role === 'client' ? '/client' : '/dashboard');
      }
    } catch (err) {
      const errorMap = {
        user_not_found: t('auth.errorUserNotFound'),
        wrong_password: t('auth.errorWrongPassword'),
      };
      setError(errorMap[err.message] || err.message || t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setError('');
    setFormData({ username: '', email: '', first_name: '', last_name: '', password: '', password2: '', role: 'specialist' });
    setShowPassword(false);
    setShowPassword2(false);
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
              <div className="form-row">
                <div className="form-group">
                  <label>{t('auth.firstName')}</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder={t('auth.firstNamePlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('auth.lastName')}</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder={t('auth.lastNamePlaceholder')}
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label>Account Type</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="specialist">Specialist (create content)</option>
                  <option value="client">Client (approve content)</option>
                </select>
              </div>
            )}

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
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  placeholder={t('auth.passwordPlaceholder')}
                />
                <button type="button" className="btn-password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>{t('auth.confirmPassword')}</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword2 ? 'text' : 'password'}
                    name="password2"
                    value={formData.password2}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                  />
                  <button type="button" className="btn-password-toggle" onClick={() => setShowPassword2(!showPassword2)} tabIndex={-1}>
                    {showPassword2 ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
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
