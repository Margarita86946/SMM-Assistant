import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import '../styles/Account.css';
import '../styles/Auth.css';

const AVATAR_GRADIENTS = [
  ['#6366F1', '#8B5CF6'],
  ['#EC4899', '#F43F5E'],
  ['#F59E0B', '#F97316'],
  ['#10B981', '#06B6D4'],
  ['#3B82F6', '#6366F1'],
  ['#8B5CF6', '#EC4899'],
  ['#14B8A6', '#3B82F6'],
  ['#EF4444', '#F97316'],
];

function getAvatarGradient(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  const pair = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}

function getInitials(firstName, lastName, username) {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

function Account() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';

  const fileInputRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '' });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');

  const [pwData, setPwData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  useEffect(() => {
    profileAPI.get().then(res => {
      setProfile(res.data);
      setFormData({ first_name: res.data.first_name || '', last_name: res.data.last_name || '', email: res.data.email || '' });
      if (res.data.avatar) localStorage.setItem('avatar', res.data.avatar);
      else localStorage.removeItem('avatar');
    }).catch(() => {
    }).finally(() => setLoading(false));
  }, []);

  const handleAvatarClick = () => {
    setAvatarError('');
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setAvatarError(t('account.avatarTypeError'));
      return;
    }
    if (file.size > 1_500_000) {
      setAvatarError(t('account.avatarSizeError'));
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setAvatarUploading(true);
      setAvatarError('');
      try {
        const res = await profileAPI.update({ avatar: base64 });
        setProfile(prev => ({ ...prev, avatar: res.data.avatar }));
        localStorage.setItem('avatar', res.data.avatar);
      } catch (err) {
        const code = err.message;
        setAvatarError(code === 'avatar_too_large' ? t('account.avatarTooLarge') : t('account.avatarSizeError'));
      } finally {
        setAvatarUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const formatDate = (d) => {
    if (!d) return t('account.never');
    return new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleProfileSave = async () => {
    setSaving(true);
    setProfileMsg('');
    setProfileError('');
    try {
      const res = await profileAPI.update(formData);
      setProfile(res.data);
      setProfileMsg(t('account.savedMsg'));
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err) {
      const code = err.message;
      setProfileError(code === 'email_taken' ? t('account.emailTaken') : (err.message || t('account.failedSave')));
    } finally {
      setSaving(false);
    }
  };

  const handlePwSave = async () => {
    if (pwData.new_password !== pwData.confirm_password) {
      setPwError(t('auth.passwordMismatch'));
      return;
    }
    if (pwData.current_password === pwData.new_password) {
      setPwError(t('account.pwSameError'));
      return;
    }
    setPwSaving(true);
    setPwMsg('');
    setPwError('');
    try {
      await profileAPI.changePassword({ current_password: pwData.current_password, new_password: pwData.new_password });
      setPwMsg(t('account.pwChangedMsg'));
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('token_expires_at');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const code = err.message;
      setPwError(code === 'wrong_current_password' ? t('account.wrongCurrentPw') : (err.message || t('account.failedPwChange')));
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="account-container"><div className="loading">{t('common.loading')}</div></div>;
  if (!profile) return null;

  const initials = getInitials(profile.first_name, profile.last_name, profile.username);
  const avatarGradient = getAvatarGradient(profile.username);
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.username;

  return (
    <div className="account-container">
      <div className="account-header">
        <h1>{t('account.title')}</h1>
        <p className="account-subtitle">{t('account.subtitle')}</p>
      </div>

      {/* Profile Hero */}
      <div className="account-hero-card">
        <div className="account-avatar-col">
          <div className="account-avatar-wrap" onClick={handleAvatarClick} title={t('account.uploadAvatar')}>
            {profile.avatar ? (
              <img src={profile.avatar} alt="avatar" className="account-avatar-lg account-avatar-img" />
            ) : (
              <div className="account-avatar-lg" style={{ background: avatarGradient }}>{initials}</div>
            )}
            <div className="account-avatar-overlay">
              {avatarUploading ? (
                <div className="account-avatar-spinner" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="account-avatar-input" onChange={handleAvatarChange} />
          </div>
          {avatarError && <p className="account-avatar-error">{avatarError}</p>}
        </div>
        <div className="account-hero-info">
          <h2 className="account-hero-name">{fullName}</h2>
          <span className="account-hero-username">@{profile.username}</span>
          <span className="account-hero-email">{profile.email}</span>
        </div>
        <div className="account-hero-stats">
          <div className="account-stat">
            <span className="account-stat-label">{t('account.memberSince')}</span>
            <span className="account-stat-value">{formatDate(profile.date_joined)}</span>
          </div>
          <div className="account-stat">
            <span className="account-stat-label">{t('account.lastLogin')}</span>
            <span className="account-stat-value">{formatDate(profile.last_login)}</span>
          </div>
          <div className="account-stat">
            <span className="account-stat-label">{t('account.usernameLabel')}</span>
            <span className="account-stat-value account-stat-username">@{profile.username}</span>
          </div>
        </div>
      </div>

      {/* Edit Profile */}
      <div className="account-card">
        <div className="account-card-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          {t('account.editProfile')}
        </div>

        {profileError && <div className="error-message">{profileError}</div>}
        {profileMsg && <div className="success-message">{profileMsg}</div>}

        <div className="account-form-row">
          <div className="account-form-group">
            <label>{t('auth.firstName')}</label>
            <input type="text" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} placeholder={t('auth.firstNamePlaceholder')} />
          </div>
          <div className="account-form-group">
            <label>{t('auth.lastName')}</label>
            <input type="text" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} placeholder={t('auth.lastNamePlaceholder')} />
          </div>
        </div>
        <div className="account-form-group">
          <label>{t('auth.email')}</label>
          <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder={t('auth.emailPlaceholder')} />
        </div>

        <button className="account-btn-save" onClick={handleProfileSave} disabled={saving}>
          {saving ? t('common.saving') : t('account.saveChanges')}
        </button>
      </div>

      {/* Change Password */}
      <div className="account-card">
        <div className="account-card-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {t('account.changePassword')}
        </div>

        {pwError && <div className="error-message">{pwError}</div>}
        {pwMsg && <div className="success-message">{pwMsg}</div>}

        {['current_password', 'new_password', 'confirm_password'].map((field) => (
          <div className="account-form-group" key={field}>
            <label>{t(`account.${field}`)}</label>
            <div className="password-input-wrapper">
              <input
                type={showPw[field === 'current_password' ? 'current' : field === 'new_password' ? 'new' : 'confirm'] ? 'text' : 'password'}
                value={pwData[field]}
                onChange={e => setPwData({ ...pwData, [field]: e.target.value })}
                placeholder="••••••••"
              />
              <button type="button" className="btn-password-toggle"
                onClick={() => {
                  const key = field === 'current_password' ? 'current' : field === 'new_password' ? 'new' : 'confirm';
                  setShowPw(p => ({ ...p, [key]: !p[key] }));
                }}
                tabIndex={-1}>
                {(showPw[field === 'current_password' ? 'current' : field === 'new_password' ? 'new' : 'confirm']) ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}

        <p className="account-pw-hint">{t('account.pwHint')}</p>

        <button className="account-btn-save account-btn-danger" onClick={handlePwSave} disabled={pwSaving}>
          {pwSaving ? t('common.saving') : t('account.changePasswordBtn')}
        </button>
      </div>
    </div>
  );
}

export default Account;
