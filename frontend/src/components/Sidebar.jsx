import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useActiveClient } from '../context/ActiveClientContext';
import { useTranslation } from '../i18n';
import SmmLogo from './SmmLogo';
import { useNotifications } from '../context/NotificationsContext';
import '../styles/Sidebar.css';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem('username') || 'User';
  const { theme, setTheme, language, setLanguage } = useSettings();
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  const role = localStorage.getItem('role');
  const isClient = role === 'client';
  const isOwner = role === 'owner';
  const isSpecialist = role === 'specialist';

  const { clients, activeClientId, setActiveClientId } = useActiveClient();
  const { soundEnabled, updateSoundEnabled } = useNotifications();

  const COMMON_NAV = useMemo(() => [
    {
      path: '/dashboard',
      label: t('nav.dashboard'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      ),
    },
    {
      path: '/posts',
      label: t('nav.allPosts'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
      ),
    },
    {
      path: '/create',
      label: t('nav.createPost'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      ),
    },
    {
      path: '/calendar',
      label: t('nav.calendar'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
    },
    {
      path: '/generate',
      label: t('nav.aiGenerate'),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [language]);

  const CLIENTS_ITEM = {
    path: '/clients',
    label: 'Clients',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  };

  const NAV_ITEMS = useMemo(() => {
    if (isClient) {
      return [
        {
          path: '/client',
          label: 'Pending Approvals',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          ),
        },
        {
          path: '/account',
          label: t('settings.account'),
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          ),
        },
      ];
    }
    if (isSpecialist) return [...COMMON_NAV, CLIENTS_ITEM];
    // owner
    return COMMON_NAV;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, isClient, isOwner, isSpecialist]);

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('token_expires_at');
    localStorage.removeItem('avatar');
    localStorage.removeItem('role');
    localStorage.removeItem('activeClientId');
    localStorage.removeItem('notifications_sound');
    window.location.href = '/login';
  };

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <SmmLogo size={34} />
        </div>
        <span className="sidebar-brand-name">SMM Assistant</span>
      </div>

      {isSpecialist && clients.length > 0 && (
        <div className="sidebar-client-selector">
          <p className="sidebar-section-label sidebar-section-label--client">{t('sidebar.clientLabel')}</p>
          <div className="sidebar-client-select-wrap">
            <svg className="sidebar-client-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <select
              className="sidebar-client-select"
              value={activeClientId ?? ''}
              onChange={e => setActiveClientId(e.target.value ? parseInt(e.target.value, 10) : null)}
            >
              <option value="">{t('sidebar.allClients')}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        <p className="sidebar-section-label">{t('nav.menu')}</p>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`sidebar-nav-item${isActive(item.path) ? ' active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {localStorage.getItem('avatar')
              ? <img src={localStorage.getItem('avatar')} alt="avatar" className="sidebar-avatar-img" />
              : username.charAt(0).toUpperCase()
            }
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-username">{username}</span>
            <span className="sidebar-user-role">
              {isClient ? 'Client' : isOwner ? 'Owner' : isSpecialist ? 'Specialist' : t('settings.contentManager')}
            </span>
          </div>
        </div>

        <div className="sidebar-settings-wrap" ref={settingsRef}>
          {settingsOpen && (
            <div className="settings-panel">
              <div className="settings-row">
                <span className="settings-row-label">{t('settings.darkMode')}</span>
                <div
                  className="theme-toggle"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  <span className="theme-toggle-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
                  <div className={`theme-toggle-track${theme === 'dark' ? ' on' : ''}`}>
                    <div className="theme-toggle-thumb" />
                  </div>
                </div>
              </div>

              <div className="settings-row">
                <span className="settings-row-label">{t('settings.language')}</span>
                <select
                  className="settings-lang-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="EN">EN</option>
                  <option value="RU">RU</option>
                  <option value="AM">AM</option>
                </select>
              </div>

              <div className="settings-row">
                <span className="settings-row-label">{t('settings.notificationSound')}</span>
                <div
                  className="theme-toggle"
                  onClick={() => updateSoundEnabled(!soundEnabled)}
                >
                  <span className="theme-toggle-icon">🔔</span>
                  <div className={`theme-toggle-track${soundEnabled ? ' on' : ''}`}>
                    <div className="theme-toggle-thumb" />
                  </div>
                </div>
              </div>

              <div className="settings-row settings-row--link" onClick={() => { navigate('/account'); setSettingsOpen(false); }}>
                <span className="settings-row-label">{t('settings.account')}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="settings-row-chevron">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>

              <div className="settings-divider" />

              <button className="settings-logout-btn" onClick={handleLogout}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                {t('settings.logout')}
              </button>
            </div>
          )}

          <button
            className={`sidebar-settings-btn${settingsOpen ? ' active' : ''}`}
            onClick={() => setSettingsOpen((o) => !o)}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
