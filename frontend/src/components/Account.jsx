import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileAPI, brandAPI, instagramAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import {
  FiCamera, FiEdit2, FiLock, FiLink, FiInstagram,
  FiCheckSquare, FiTag, FiEye, FiEyeOff,
} from 'react-icons/fi';
import '../styles/Account.css';
import '../styles/Auth.css';
import '../styles/Clients.css';

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
  const [formData, setFormData] = useState({ first_name: '', last_name: '' });
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveSaving, setAutoApproveSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');


  const [pwData, setPwData] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  const [brandProfiles, setBrandProfiles] = useState({});
  const [brandSaving, setBrandSaving] = useState({});
  const [brandMsg, setBrandMsg] = useState({});
  const [brandError, setBrandError] = useState({});

  const [igAccounts, setIgAccounts] = useState([]);
  const [igLoading, setIgLoading] = useState(true);
  const [igConnecting, setIgConnecting] = useState(false);
  const [igDisconnecting, setIgDisconnecting] = useState(null);
  const [igMsg, setIgMsg] = useState('');
  const [igError, setIgError] = useState('');

  const loadBrandProfiles = async (accounts) => {
    const profiles = {};
    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const res = await brandAPI.get(acc.id);
          profiles[acc.id] = {
            brand_name: res.data.brand_name || '',
            voice_tone: res.data.voice_tone || '',
            target_audience: res.data.target_audience || '',
            keywords: res.data.keywords || '',
            banned_words: res.data.banned_words || '',
          };
        } catch {
          profiles[acc.id] = { brand_name: '', voice_tone: '', target_audience: '', keywords: '', banned_words: '' };
        }
      })
    );
    setBrandProfiles(profiles);
  };

  const loadIgStatus = async () => {
    try {
      const res = await instagramAPI.getStatus();
      const accounts = res.data.accounts || [];
      setIgAccounts(accounts);
      if (localStorage.getItem('role') !== 'specialist' && accounts.length > 0) {
        await loadBrandProfiles(accounts);
      }
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      setFormData({ first_name: res.data.first_name || '', last_name: res.data.last_name || '' });
      setAutoApprove(!!res.data.auto_approve);
      if (res.data.avatar) localStorage.setItem('avatar', res.data.avatar);
      else localStorage.removeItem('avatar');
      if (res.data.notifications_sound !== undefined) {
        localStorage.setItem('notifications_sound', String(res.data.notifications_sound));
      }
    }).catch(() => {
      setProfileError(t('account.failedSave'));
    }).finally(() => setLoading(false));

  }, [t]);

  const handleBrandSave = async (accountId) => {
    setBrandSaving(s => ({ ...s, [accountId]: true }));
    setBrandMsg(m => ({ ...m, [accountId]: '' }));
    setBrandError(e => ({ ...e, [accountId]: '' }));
    try {
      await brandAPI.update(accountId, brandProfiles[accountId] || {});
      setBrandMsg(m => ({ ...m, [accountId]: t('account.savedMsg') }));
      setTimeout(() => setBrandMsg(m => ({ ...m, [accountId]: '' })), 3000);
    } catch (err) {
      setBrandError(e => ({ ...e, [accountId]: err.message || t('account.failedSave') }));
    } finally {
      setBrandSaving(s => ({ ...s, [accountId]: false }));
    }
  };

  const handleBrandChange = (accountId, field, value) => {
    setBrandProfiles(p => ({
      ...p,
      [accountId]: { ...(p[accountId] || {}), [field]: value },
    }));
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
      setEditingProfile(false);
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err) {
      setProfileError(err.message || t('account.failedSave'));
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
                <FiCamera />
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

      <div className="account-card">
        <div className="account-card-title">
          <FiEdit2 />
          {t('account.editProfile')}
          {!editingProfile && (
            <button className="account-edit-btn" onClick={() => setEditingProfile(true)}>
              <FiEdit2 />
              {t('common.edit')}
            </button>
          )}
        </div>

        {profileError && <div className="error-message">{profileError}</div>}
        {profileMsg && <div className="success-message">{profileMsg}</div>}

        <div className="account-form-row">
          <div className="account-form-group">
            <label>{t('auth.firstName')}</label>
            {editingProfile
              ? <input type="text" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} placeholder={t('auth.firstNamePlaceholder')} />
              : <div className="account-field-readonly">{formData.first_name || <span className="account-field-empty">—</span>}</div>
            }
          </div>
          <div className="account-form-group">
            <label>{t('auth.lastName')}</label>
            {editingProfile
              ? <input type="text" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} placeholder={t('auth.lastNamePlaceholder')} />
              : <div className="account-field-readonly">{formData.last_name || <span className="account-field-empty">—</span>}</div>
            }
          </div>
        </div>
        {editingProfile && (
          <div className="account-form-actions">
            <button className="account-btn-save" onClick={handleProfileSave} disabled={saving}>
              {saving ? t('common.saving') : t('account.saveChanges')}
            </button>
            <button className="account-btn-cancel" onClick={() => {
              setEditingProfile(false);
              setProfileError('');
              if (profile) setFormData({ first_name: profile.first_name || '', last_name: profile.last_name || '' });
            }}>
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>

      <div className="account-card">
        <div className="account-card-title">
          <FiLock />
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
                  <FiEyeOff />
                ) : (
                  <FiEye />
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

      {localStorage.getItem('role') !== 'specialist' && <div className="account-card">
        <div className="account-card-title">
          <FiLink />
          {t('instagram.cardTitle')}
        </div>

        {igError && <div className="error-message">{igError}</div>}
        {igMsg && <div className="success-message">{igMsg}</div>}

        {igLoading ? (
          <div className="ig-card"><span className="ig-info-name ig-info-muted">{t('common.loading')}</span></div>
        ) : igAccounts.length === 0 ? (
          <div className="ig-card ig-card--disconnected">
            <div className="ig-icon">
              <FiInstagram />
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
                  <FiInstagram />
                </div>
                <div className="ig-info">
                  <div className="ig-info-head">
                    <span className="ig-info-name">@{acc.username}</span>
                    <span className="ig-badge">
                      <span className="ig-badge-dot" />
                      {t('instagram.connected')}
                    </span>

                  </div>
                  {acc.expires_at && (
                    <span className="ig-info-meta">
                      {t('instagram.accessExpires')} {formatDate(acc.expires_at)}
                    </span>
                  )}
                </div>
                <div className="ig-actions">
                  <button
                    className="account-btn-save account-btn-danger ig-btn"
                    onClick={() => handleInstagramDisconnect(acc.id)}
                    disabled={igDisconnecting === acc.id}
                  >
                    {igDisconnecting === acc.id ? t('instagram.disconnecting') : t('instagram.disconnect')}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}>
              <button className="account-btn-save ig-btn ig-btn--connect" onClick={handleInstagramConnect} disabled={igConnecting}>
                {igConnecting ? t('instagram.redirecting') : t('instagram.connect')}
              </button>
            </div>
          </>
        )}
      </div>}

      {localStorage.getItem('role') === 'client' && (
        <div className="account-card">
          <div className="account-card-title">
            <FiCheckSquare />
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
              title={autoApprove ? t('account.autoApproveDisable') : t('account.autoApproveEnable')}
            >
              <span className="auto-approve-thumb" />
            </button>
          </div>
        </div>
      )}

      {localStorage.getItem('role') !== 'specialist' && igAccounts.map(acc => {
        const bp = brandProfiles[acc.id] || { brand_name: '', voice_tone: '', target_audience: '', keywords: '', banned_words: '' };
        return (
          <div className="account-card" key={`brand-${acc.id}`}>
            <div className="account-card-title">
              <FiTag />
              {t('account.brandProfileTitle', { username: acc.username })}
            </div>

            {brandError[acc.id] && <div className="error-message">{brandError[acc.id]}</div>}
            {brandMsg[acc.id] && <div className="success-message">{brandMsg[acc.id]}</div>}

            <p className="account-pw-hint" style={{ marginTop: 0, marginBottom: 16 }}>
              {t('account.brandProfileHint')}
            </p>

            <div className="account-form-group">
              <label>{t('account.brandName')}</label>
              <input type="text" value={bp.brand_name}
                onChange={e => handleBrandChange(acc.id, 'brand_name', e.target.value)}
                placeholder={t('account.brandNamePlaceholder')} />
            </div>
            <div className="account-form-group">
              <label>{t('account.voiceTone')}</label>
              <input type="text" value={bp.voice_tone}
                onChange={e => handleBrandChange(acc.id, 'voice_tone', e.target.value)}
                placeholder={t('account.voiceTonePlaceholder')} />
            </div>
            <div className="account-form-group">
              <label>{t('account.targetAudience')}</label>
              <input type="text" value={bp.target_audience}
                onChange={e => handleBrandChange(acc.id, 'target_audience', e.target.value)}
                placeholder={t('account.targetAudiencePlaceholder')} />
            </div>
            <div className="account-form-group">
              <label>{t('account.keywords')}</label>
              <input type="text" value={bp.keywords}
                onChange={e => handleBrandChange(acc.id, 'keywords', e.target.value)}
                placeholder={t('account.keywordsPlaceholder')} />
            </div>
            <div className="account-form-group">
              <label>{t('account.bannedWords')}</label>
              <input type="text" value={bp.banned_words}
                onChange={e => handleBrandChange(acc.id, 'banned_words', e.target.value)}
                placeholder={t('account.bannedWordsPlaceholder')} />
            </div>

            <button className="account-btn-save" onClick={() => handleBrandSave(acc.id)} disabled={brandSaving[acc.id]}>
              {brandSaving[acc.id] ? t('common.saving') : t('account.saveChanges')}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default Account;
