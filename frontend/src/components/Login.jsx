import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, invitationsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import SmmLogo from './SmmLogo';
import { FiEye, FiEyeOff, FiZap, FiCalendar, FiBarChart2, FiUser, FiUsers } from 'react-icons/fi';
import '../styles/Auth.css';

function Login({ isLoginMode }) {
  const [isLogin, setIsLogin] = useState(isLoginMode);
  const [searchParams] = useSearchParams();
  const invitationToken = searchParams.get('token') || '';

  const [invitation, setInvitation] = useState(null);
  const [invLoading, setInvLoading] = useState(!!invitationToken && !isLoginMode);
  const [invError, setInvError] = useState('');

  // Quiz step: null = not yet chosen (only shown for self-registration)
  const [chosenRole, setChosenRole] = useState(null);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    password2: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();

  // On register with invitation token: fetch invitation to pre-fill email
  useEffect(() => {
    if (isLogin || !invitationToken) return;
    setInvLoading(true);
    invitationsAPI.lookup(invitationToken)
      .then(res => {
        setInvitation(res.data);
        setFormData(prev => ({
          ...prev,
          email: res.data.client_email || '',
          // Pre-fill username if this is a reactivation so the field can be locked
          username: res.data.existing_username || prev.username,
        }));
      })
      .catch(() => setInvError('This invitation link is invalid or has expired.'))
      .finally(() => setInvLoading(false));
  }, [isLogin, invitationToken]);

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
        window.dispatchEvent(new StorageEvent('storage', { key: 'role' }));
        navigate(response.data.role === 'client' ? '/client' : '/dashboard');
      } else {
        if (formData.password !== formData.password2) {
          setError(t('auth.passwordMismatch'));
          setLoading(false);
          return;
        }
        const payload = {
          username: formData.username,
          email: formData.email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          password: formData.password,
        };
        if (invitationToken) {
          payload.invitation_token = invitationToken;
        } else {
          payload.role = chosenRole;
        }
        const registerResponse = await authAPI.register(payload);
        localStorage.setItem('token', registerResponse.data.token);
        localStorage.setItem('username', formData.username);
        if (registerResponse.data.role) localStorage.setItem('role', registerResponse.data.role);
        if (registerResponse.data.expires_at) {
          localStorage.setItem('token_expires_at', registerResponse.data.expires_at);
        }
        window.dispatchEvent(new StorageEvent('storage', { key: 'role' }));
        navigate(registerResponse.data.role === 'client' ? '/client' : '/dashboard');
      }
    } catch (err) {
      const errorMap = {
        user_not_found: t('auth.errorUserNotFound'),
        wrong_password: t('auth.errorWrongPassword'),
        account_disabled: t('auth.errorAccountDisabled'),
      };
      setError(errorMap[err.message] || err.message || t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setError('');
    setFormData({ username: '', email: '', first_name: '', last_name: '', password: '', password2: '' });
    setShowPassword(false);
    setShowPassword2(false);
    setChosenRole(null);
    navigate(isLogin ? '/register' : '/login');
  };

  const isClientInvite = !isLogin && !!invitationToken;
  // Self-registration without a role chosen yet → show quiz
  const showQuiz = !isLogin && !isClientInvite && chosenRole === null;

  return (
    <div className="auth-container">
      <div className="auth-left">
        <div className="auth-brand-logo">
          <SmmLogo size={48} />
        </div>
        <h1>{t('auth.tagline')}</h1>
        <p>{t('auth.taglineDesc')}</p>

        <div className="auth-features">
          <div className="auth-feature">
            <div className="auth-feature-icon"><FiZap /></div>
            <div className="auth-feature-text">
              <strong>{t('auth.feature1Title')}</strong>
              <span>{t('auth.feature1Desc')}</span>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><FiCalendar /></div>
            <div className="auth-feature-text">
              <strong>{t('auth.feature2Title')}</strong>
              <span>{t('auth.feature2Desc')}</span>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><FiBarChart2 /></div>
            <div className="auth-feature-text">
              <strong>{t('auth.feature3Title')}</strong>
              <span>{t('auth.feature3Desc')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box">

          {/* ── Quiz step ── */}
          {showQuiz ? (
            <>
              <div className="auth-box-header">
                <h2>What's your goal?</h2>
                <p>We'll set up your account based on how you plan to use the platform.</p>
              </div>
              <div className="role-quiz">
                <button className="role-quiz-card" onClick={() => setChosenRole('owner')}>
                  <span className="role-quiz-icon"><FiUser /></span>
                  <span className="role-quiz-title">Manage my own account</span>
                  <span className="role-quiz-desc">Create and schedule posts for your personal or business Instagram.</span>
                </button>
                <button className="role-quiz-card" onClick={() => setChosenRole('specialist')}>
                  <span className="role-quiz-icon"><FiUsers /></span>
                  <span className="role-quiz-title">Manage clients' accounts</span>
                  <span className="role-quiz-desc">Invite clients, create content on their behalf, and handle approvals.</span>
                </button>
              </div>
              <p className="toggle-text">
                {t('auth.hasAccount')}{' '}
                <span onClick={toggleMode} className="toggle-link">{t('auth.signIn')}</span>
              </p>
            </>
          ) : (
            <>
              <div className="auth-box-header">
                {isClientInvite ? (
                  <>
                    <h2>Create your client account</h2>
                    {invLoading && <p>Loading invitation…</p>}
                    {invError && <p className="auth-invite-error">{invError}</p>}
                    {invitation && (
                      <p>
                        You've been invited by <strong>{invitation.specialist_name}</strong>.
                        Your account will be linked to them automatically.
                      </p>
                    )}
                  </>
                ) : !isLogin && chosenRole ? (
                  <>
                    <h2>{chosenRole === 'owner' ? 'Set up your account' : 'Set up your specialist account'}</h2>
                    <p>
                      {chosenRole === 'owner'
                        ? 'You\'ll manage your own social media.'
                        : 'You\'ll manage content for your clients.'}
                      {' '}<span className="toggle-link" style={{fontSize:'0.85em'}} onClick={() => setChosenRole(null)}>Change</span>
                    </p>
                  </>
                ) : (
                  <h2>{isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}</h2>
                )}
                {!isClientInvite && isLogin && (
                  <p>{t('auth.loginSubtitle')}</p>
                )}
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
                    disabled={loading || (isClientInvite && !!invitation?.existing_username)}
                    readOnly={isClientInvite && !!invitation?.existing_username}
                    placeholder={t('auth.usernamePlaceholder')}
                  />
                  {isClientInvite && invitation?.existing_username && (
                    <span className="auth-field-hint">Your existing username has been pre-filled.</span>
                  )}
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
                    <label>{t('auth.email')}</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      disabled={loading || isClientInvite}
                      placeholder={t('auth.emailPlaceholder')}
                      readOnly={isClientInvite}
                    />
                    {isClientInvite && (
                      <span className="auth-field-hint">Email is set by your invitation and cannot be changed.</span>
                    )}
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
                      {showPassword ? <FiEyeOff /> : <FiEye />}
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
                        {showPassword2 ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-primary" disabled={loading || (isClientInvite && (invLoading || !!invError))}>
                  {loading ? t('auth.pleaseWait') : (isLogin ? t('auth.signIn') : t('auth.createAccount'))}
                </button>
              </form>

              <p className="toggle-text">
                {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
                {!isClientInvite && (
                  <span onClick={toggleMode} className="toggle-link">
                    {isLogin ? t('auth.registerHere') : t('auth.signIn')}
                  </span>
                )}
                {isClientInvite && (
                  <span onClick={() => navigate('/login')} className="toggle-link">
                    {t('auth.signIn')}
                  </span>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
