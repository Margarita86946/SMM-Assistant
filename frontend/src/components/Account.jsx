import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileAPI, brandAPI, instagramAPI } from '../services/api';
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
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveSaving, setAutoApproveSaving] = useState(false);
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

  const [brandData, setBrandData] = useState({
    brand_name: '', voice_tone: '', target_audience: '', keywords: '', banned_words: '',
  });
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandMsg, setBrandMsg] = useState('');
  const [brandError, setBrandError] = useState('');

  const [igAccounts, setIgAccounts] = useState([]);
  const [igLoading, setIgLoading] = useState(true);
  const [igConnecting, setIgConnecting] = useState(false);
  const [igDisconnecting, setIgDisconnecting] = useState(null);
  const [igMsg, setIgMsg] = useState('');
  const [igError, setIgError] = useState('');

  const loadIgStatus = async () => {
    try {
      const res = await instagramAPI.getStatus();
      setIgAccounts(res.data.accounts || []);
    } catch {
      setIgAccounts([]);
    } finally {
      setIgLoading(false);
    }
  };

  useEffect(() => {
    loadIgStatus();
    const params = new URLSearchParams(window.location.search);
    const igParam = params.get('instagram');
    if (igParam === 'connected') {
      setIgMsg(t('instagram.connectedMsg'));
      setTimeout(() => setIgMsg(''), 4000);
    } else if (igParam === 'personal') {
      setIgError(t('instagram.personalError'));
      setTimeout(() => setIgError(''), 6000);
    } else if (igParam === 'error') {
      setIgError(t('instagram.connectError'));
      setTimeout(() => setIgError(''), 5000);
    }
    if (igParam) {
      params.delete('instagram');
      const q = params.toString();
      const url = window.location.pathname + (q ? `?${q}` : '') + window.location.hash;
      window.history.replaceState({}, '', url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstagramConnect = async () => {
    setIgConnecting(true);
    setIgError('');
    try {
      const res = await instagramAPI.getOAuthUrl();
      window.location.href = res.data.oauth_url;
    } catch (err) {
      setIgError(err.message || t('instagram.connectError'));
      setIgConnecting(false);
    }
  };

  const handleInstagramDisconnect = async (accountId) => {
    if (!window.confirm(t('instagram.disconnectConfirm'))) return;
    setIgDisconnecting(accountId);
    setIgError('');
    try {
      await instagramAPI.disconnect(accountId);
      await loadIgStatus();
      setIgMsg(t('instagram.disconnectedMsg'));
      setTimeout(() => setIgMsg(''), 3000);
    } catch (err) {
      setIgError(err.message || t('instagram.disconnectError'));
    } finally {
      setIgDisconnecting(null);
    }
  };

  useEffect(() => {
    profileAPI.get().then(res => {
      setProfile(res.data);
      setFormData({ first_name: res.data.first_name || '', last_name: res.data.last_name || '', email: res.data.email || '' });
      setAutoApprove(!!res.data.auto_approve);
      if (res.data.avatar) localStorage.setItem('avatar', res.data.avatar);
      else localStorage.removeItem('avatar');
      // Sync sound preference into localStorage for NotificationsContext
      if (res.data.notifications_sound !== undefined) {
        localStorage.setItem('notifications_sound', String(res.data.notifications_sound));
      }
    }).catch(() => {
      setProfileError(t('account.failedSave'));
    }).finally(() => setLoading(false));

    brandAPI.get().then(res => {
      setBrandData({
        brand_name: res.data.brand_name || '',
        voice_tone: res.data.voice_tone || '',
        target_audience: res.data.target_audience || '',
        keywords: res.data.keywords || '',
        banned_words: res.data.banned_words || '',
      });
    }).catch(() => setBrandError(t('account.failedSave')));
  }, [t]);

  const handleBrandSave = async () => {
    setBrandSaving(true);
    setBrandMsg('');
    setBrandError('');
    try {
      await brandAPI.update(brandData);
      setBrandMsg(t('account.savedMsg'));
      setTimeout(() => setBrandMsg(''), 3000);
    } catch (err) {
      setBrandError(err.message || t('account.failedSave'));
    } finally {
      setBrandSaving(false);
    }
  };

  const handleAutoApproveToggle = async () => {
    const newVal = !autoApprove;
    setAutoApprove(newVal);
    setAutoApproveSaving(true);
    setProfileError('');
    try {
      await profileAPI.update({ auto_approve: newVal });
    } catch {
      setAutoApprove(!newVal);
      setProfileError(t('account.failedSave'));
    } finally {
      setAutoApproveSaving(false);
    }
  };

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

      {/* Connected Accounts */}
      <div className="account-card">
        <div className="account-card-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          {t('instagram.cardTitle')}
        </div>

        {igError && <div className="error-message">{igError}</div>}
        {igMsg && <div className="success-message">{igMsg}</div>}

        {igLoading ? (
          <div className="ig-card"><span className="ig-info-name ig-info-muted">{t('common.loading')}</span></div>
        ) : igAccounts.length === 0 ? (
          <div className="ig-card ig-card--disconnected">
            <div className="ig-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </div>
            <div className="ig-info">
              <span className="ig-info-name ig-info-muted">{t('instagram.notConnected')}</span>
              <span className="ig-info-meta">{t('instagram.notConnectedHint')}</span>
            </div>
            <div className="ig-actions">
              <button className="account-btn-save ig-btn ig-btn--connect" onClick={handleInstagramConnect} disabled={igConnecting}>
                {igConnecting ? t('instagram.redirecting') : t('instagram.connect')}
              </button>
            </div>
          </div>
        ) : (
          <>
            {igAccounts.map(acc => (
              <div key={acc.id} className="ig-card ig-card--connected" style={{ marginBottom: 10 }}>
                <div className="ig-icon ig-icon--active">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </div>
                <div className="ig-info">
                  <div className="ig-info-head">
                    <span className="ig-info-name">@{acc.username}</span>
                    <span className="ig-badge">
                      <span className="ig-badge-dot" />
                      {t('instagram.connected')}
                    </span>
                    {acc.is_client_account && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '2px 8px' }}>
                        Client{acc.client_username ? `: @${acc.client_username}` : ''}
                      </span>
                    )}
                  </div>
                  {acc.expires_at && (
                    <span className="ig-info-meta">
                      {t('instagram.accessExpires')} {formatDate(acc.expires_at)}
                    </span>
                  )}
                </div>
                {!acc.is_client_account && (
                  <div className="ig-actions">
                    <button
                      className="account-btn-save account-btn-danger ig-btn"
                      onClick={() => handleInstagramDisconnect(acc.id)}
                      disabled={igDisconnecting === acc.id}
                    >
                      {igDisconnecting === acc.id ? t('instagram.disconnecting') : t('instagram.disconnect')}
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <button className="account-btn-save ig-btn ig-btn--connect" onClick={handleInstagramConnect} disabled={igConnecting}>
                {igConnecting ? t('instagram.redirecting') : t('instagram.connect')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Auto-approve toggle — clients only */}
      {localStorage.getItem('role') === 'client' && (
        <div className="account-card">
          <div className="account-card-title">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            {t('account.postApprovals')}
          </div>
          <div className="auto-approve-row">
            <div className="auto-approve-info">
              <span className="auto-approve-label">{t('account.autoApproveLabel')}</span>
              <span className="auto-approve-desc">{t('account.autoApproveHint')}</span>
            </div>
            <button
              className={`auto-approve-toggle${autoApprove ? ' on' : ''}`}
              onClick={handleAutoApproveToggle}
              disabled={autoApproveSaving}
              title={autoApprove ? 'Disable auto-approve' : 'Enable auto-approve'}
            >
              <span className="auto-approve-thumb" />
            </button>
          </div>
        </div>
      )}

      {/* Brand Profile — hidden for specialists (they use each client's profile) */}
      {localStorage.getItem('role') !== 'specialist' && <div className="account-card">
        <div className="account-card-title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          Brand Profile
        </div>

        {brandError && <div className="error-message">{brandError}</div>}
        {brandMsg && <div className="success-message">{brandMsg}</div>}

        <p className="account-pw-hint" style={{ marginTop: 0, marginBottom: 16 }}>
          {t('account.brandProfileHint')}
        </p>

        <div className="account-form-group">
          <label>{t('account.brandName')}</label>
          <input type="text" value={brandData.brand_name}
            onChange={e => setBrandData({ ...brandData, brand_name: e.target.value })}
            placeholder={t('account.brandNamePlaceholder')} />
        </div>
        <div className="account-form-group">
          <label>{t('account.voiceTone')}</label>
          <input type="text" value={brandData.voice_tone}
            onChange={e => setBrandData({ ...brandData, voice_tone: e.target.value })}
            placeholder={t('account.voiceTonePlaceholder')} />
        </div>
        <div className="account-form-group">
          <label>{t('account.targetAudience')}</label>
          <input type="text" value={brandData.target_audience}
            onChange={e => setBrandData({ ...brandData, target_audience: e.target.value })}
            placeholder={t('account.targetAudiencePlaceholder')} />
        </div>
        <div className="account-form-group">
          <label>{t('account.keywords')}</label>
          <input type="text" value={brandData.keywords}
            onChange={e => setBrandData({ ...brandData, keywords: e.target.value })}
            placeholder={t('account.keywordsPlaceholder')} />
        </div>
        <div className="account-form-group">
          <label>{t('account.bannedWords')}</label>
          <input type="text" value={brandData.banned_words}
            onChange={e => setBrandData({ ...brandData, banned_words: e.target.value })}
            placeholder={t('account.bannedWordsPlaceholder')} />
        </div>

        <button className="account-btn-save" onClick={handleBrandSave} disabled={brandSaving}>
          {brandSaving ? t('common.saving') : t('account.saveChanges')}
        </button>
      </div>}
    </div>
  );
}

export default Account;
