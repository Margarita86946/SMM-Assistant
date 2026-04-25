import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useActiveClient } from '../context/ActiveClientContext';
import { useTranslation } from '../i18n';
import SmmLogo from './SmmLogo';
import { useNotifications } from '../context/NotificationsContext';
import {
  FiGrid, FiFileText, FiPlusCircle, FiCalendar, FiZap,
  FiUsers, FiUser, FiCheckSquare, FiSettings, FiLogOut, FiBarChart2,
} from 'react-icons/fi';
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
    { path: '/dashboard', label: t('nav.dashboard'),  icon: <FiGrid /> },
    { path: '/posts',     label: t('nav.allPosts'),   icon: <FiFileText /> },
    { path: '/create',    label: t('nav.createPost'), icon: <FiPlusCircle /> },
    { path: '/calendar',  label: t('nav.calendar'),   icon: <FiCalendar /> },
    { path: '/generate',  label: t('nav.aiGenerate'), icon: <FiZap /> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [language]);

  const CLIENTS_ITEM = { path: '/clients', label: 'Clients', icon: <FiUsers /> };
  const ANALYZER_ITEM = { path: '/analyzer', label: 'Analyzer', icon: <FiBarChart2 /> };

  const NAV_ITEMS = useMemo(() => {
    if (isClient) {
      return [
        { path: '/client',  label: 'Pending Approvals',  icon: <FiCheckSquare /> },
        { path: '/account', label: t('settings.account'), icon: <FiUser /> },
      ];
    }
    if (isSpecialist) return [...COMMON_NAV, CLIENTS_ITEM, ANALYZER_ITEM];
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
            <FiUsers className="sidebar-client-icon" />
            <select
              id="sidebar-client-select"
              name="sidebar-client-select"
              className="sidebar-client-select"
              autoComplete="off"
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
                <FiUser className="settings-row-chevron" />
              </div>

              <div className="settings-divider" />

              <button className="settings-logout-btn" onClick={handleLogout}>
                <FiLogOut />
                {t('settings.logout')}
              </button>
            </div>
          )}

          <button
            className={`sidebar-settings-btn${settingsOpen ? ' active' : ''}`}
            onClick={() => setSettingsOpen((o) => !o)}
            title="Settings"
          >
            <FiSettings />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
