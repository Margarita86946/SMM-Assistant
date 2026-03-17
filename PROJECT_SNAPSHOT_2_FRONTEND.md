# PROJECT SNAPSHOT 2 — FRONTEND (JS/JSX)

All frontend source files as of 2026-03-17.
Working dir: `C:\Users\Asus\Desktop\SMM-Assistant\frontend\src\`

---

## frontend/src/index.js

```js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { SettingsProvider } from './context/SettingsContext';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>
);

reportWebVitals();
```

---

## frontend/src/App.js

```js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PostsList from './components/PostsList';
import CreatePost from './components/CreatePost';
import EditPost from './components/EditPost';
import Calendar from './components/Calendar';
import NotFound from './components/NotFound';
import ContentGenerator from './components/ContentGenerator';
import Sidebar from './components/Sidebar';
import './App.css';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('token');
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="/login" element={<PublicRoute><Login isLoginMode={true} /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Login isLoginMode={false} /></PublicRoute>} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/posts" element={<ProtectedRoute><PostsList /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
          <Route path="/edit/:id" element={<ProtectedRoute><EditPost /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/generate" element={<ProtectedRoute><ContentGenerator /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
```

---

## frontend/src/services/api.js

```js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.response?.data?.error) {
      error.message = error.response.data.error;
    } else if (error.response?.data) {
      const errors = error.response.data;
      const errorMessages = Object.entries(errors)
        .map(([key, value]) => {
          if (Array.isArray(value)) return value.join(', ');
          return value;
        })
        .join(', ');
      error.message = errorMessages;
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (userData) => api.post('/register/', userData),
  login: (credentials) => api.post('/login/', credentials),
  logout: () => api.post('/logout/'),
};

export const postsAPI = {
  getAll: () => api.get('/posts/'),
  getOne: (id) => api.get(`/posts/${id}/`),
  create: (postData) => api.post('/posts/', postData),
  update: (id, postData) => api.put(`/posts/${id}/`, postData),
  delete: (id) => api.delete(`/posts/${id}/`),
};

export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats/'),
};

export const calendarAPI = {
  getMonthPosts: (month, year) => api.get(`/calendar/?month=${month}&year=${year}`),
  getTodayPosts: () => api.get('/calendar/today/'),
};

export const aiAPI = {
  generateContent: (data) => api.post('/generate-content/', data),
  generateImage: (prompt, platform = 'instagram') => api.post('/generate-image/', { prompt, platform }),
  polishContent: (data) => api.post('/polish-content/', data),
};

export default api;
```

---

## frontend/src/context/SettingsContext.jsx

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const VALID_LANGUAGES = ['EN', 'RU', 'AM'];
const VALID_THEMES = ['light', 'dark'];

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('theme') || 'light';
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    return saved;
  });
  const [language, setLanguageState] = useState(() => {
    const saved = localStorage.getItem('language');
    return VALID_LANGUAGES.includes(saved) ? saved : 'EN';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  const setTheme = (t) => {
    const value = VALID_THEMES.includes(t) ? t : 'light';
    setThemeState(value);
    localStorage.setItem('theme', value);
  };

  const setLanguage = (l) => {
    const value = VALID_LANGUAGES.includes(l) ? l : 'EN';
    setLanguageState(value);
    localStorage.setItem('language', value);
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme, language, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used inside <SettingsProvider>');
  }
  return ctx;
}
```

---

## frontend/src/components/Sidebar.jsx

```jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../i18n';
import '../styles/Sidebar.css';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem('username') || 'User';
  const { theme, setTheme, language, setLanguage } = useSettings();
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  const NAV_ITEMS = useMemo(() => [
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
  ], [language]);

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
          </svg>
        </div>
        <span className="sidebar-brand-name">SMM Assistant</span>
      </div>

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
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-username">{username}</span>
            <span className="sidebar-user-role">Content Manager</span>
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

              <div className="settings-divider" />

              <button className="settings-logout-btn" onClick={handleLogout}>
                🚪 {t('settings.logout')}
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
```

---

## frontend/src/components/Login.jsx

```jsx
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
```

---

## frontend/src/components/Dashboard.jsx

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/Dashboard.css';

function Dashboard() {
  const [stats, setStats] = useState({
    total_posts: 0,
    posts_this_week: 0,
    draft_posts: 0,
    scheduled_posts: 0,
  });
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const username = localStorage.getItem('username');

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [statsResponse, postsResponse] = await Promise.all([
        dashboardAPI.getStats(),
        postsAPI.getAll(),
      ]);

      setStats(statsResponse.data);
      const allPosts = postsResponse.data.results ?? postsResponse.data;
      setRecentPosts(allPosts.slice(0, 5));

    } catch {
      setError(t('dashboard.failedLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const formatDate = (dateString) => {
    if (!dateString) return t('dashboard.notScheduled');
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { text: t('posts.draft'), class: 'badge-draft' },
      scheduled: { text: t('posts.scheduled'), class: 'badge-scheduled' },
      ready_to_post: { text: t('posts.ready'), class: 'badge-ready' },
      posted: { text: t('posts.posted'), class: 'badge-posted' },
    };
    const badge = badges[status] || { text: status, class: 'badge-default' };
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">{t('dashboard.loading')}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">

      <div className="dashboard-header">
        <div>
          <h1>{t('dashboard.welcome', { username })}</h1>
          <p className="subtitle">{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-info">
            <h3>{stats.total_posts}</h3>
            <p>{t('dashboard.totalPosts')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-info">
            <h3>{stats.posts_this_week}</h3>
            <p>{t('dashboard.thisWeek')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✏️</div>
          <div className="stat-info">
            <h3>{stats.draft_posts}</h3>
            <p>{t('dashboard.drafts')}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏰</div>
          <div className="stat-info">
            <h3>{stats.scheduled_posts}</h3>
            <p>{t('dashboard.scheduled')}</p>
          </div>
        </div>
      </div>

      <div className="recent-posts-section">
        <div className="section-header">
          <h2>{t('dashboard.recentPosts')}</h2>
          <button className="btn-view-all" onClick={() => navigate('/posts')}>
            {t('dashboard.viewAll')}
          </button>
        </div>

        {recentPosts.length === 0 ? (
          <div className="empty-state">
            <p>{t('dashboard.noPosts')}</p>
            <button className="btn-create" onClick={() => navigate('/create')}>
              {t('dashboard.createFirst')}
            </button>
          </div>
        ) : (
          <div className="posts-list">
            {recentPosts.map((post) => (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <h3>
                    {post.caption.length > 50
                      ? post.caption.substring(0, 50) + '...'
                      : post.caption}
                  </h3>
                  {getStatusBadge(post.status)}
                </div>
                <div className="post-meta">
                  <span className="post-platform">
                    {post.platform === 'instagram' && '📷 Instagram'}
                    {post.platform === 'linkedin' && '💼 LinkedIn'}
                    {post.platform === 'twitter' && '🐦 Twitter'}
                  </span>
                  <span className="post-date">{formatDate(post.scheduled_time)}</span>
                </div>
                <div className="post-hashtags">
                  {post.hashtags.length > 60
                    ? post.hashtags.substring(0, 60) + '...'
                    : post.hashtags}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="quick-actions">
        <h2>{t('dashboard.quickActions')}</h2>
        <div className="actions-grid">
          <button className="action-btn" onClick={() => navigate('/create')}>
            <span className="action-icon">✨</span>
            <span>{t('dashboard.createNew')}</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/posts')}>
            <span className="action-icon">📋</span>
            <span>{t('dashboard.viewAllPosts')}</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/calendar')}>
            <span className="action-icon">📅</span>
            <span>{t('dashboard.calendarView')}</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/generate')}>
            <span className="action-icon">🤖</span>
            <span>{t('dashboard.aiGenerate')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
```

---

## frontend/src/components/PostsList.jsx

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/PostsList.css';

const PLATFORM_LABELS = {
  instagram: '📷 Instagram',
  linkedin:  '💼 LinkedIn',
  twitter:   '🐦 Twitter',
};

function PostsList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const navigate = useNavigate();
  const { t } = useTranslation();

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await postsAPI.getAll();
      setPosts(response.data.results ?? response.data);
      setLoading(false);
    } catch {
      setError(t('posts.failedLoad'));
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm(t('posts.confirmDelete'))) {
      try {
        await postsAPI.delete(id);
        setPosts(posts.filter(post => post.id !== id));
      } catch {
        alert(t('posts.failedDelete'));
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('posts.notScheduled');
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft:         { text: t('posts.draft'),        cls: 'badge-draft'     },
      scheduled:     { text: t('posts.scheduled'),    cls: 'badge-scheduled' },
      ready_to_post: { text: t('posts.ready'),        cls: 'badge-ready'     },
      posted:        { text: t('posts.posted'),       cls: 'badge-posted'    },
    };
    const badge = badges[status] || { text: status, cls: 'badge-default' };
    return <span className={`status-badge ${badge.cls}`}>{badge.text}</span>;
  };

  const filtered = posts.filter((post) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      post.caption.toLowerCase().includes(q) ||
      post.hashtags.toLowerCase().includes(q);
    const matchPlatform = filterPlatform === 'all' || post.platform === filterPlatform;
    const matchStatus   = filterStatus   === 'all' || post.status   === filterStatus;
    return matchSearch && matchPlatform && matchStatus;
  });

  const hasActiveFilter = search || filterPlatform !== 'all' || filterStatus !== 'all';

  const clearFilters = () => {
    setSearch('');
    setFilterPlatform('all');
    setFilterStatus('all');
  };

  if (loading) return <div className="posts-container"><div className="loading">{t('posts.loading')}</div></div>;

  return (
    <div className="posts-container">
      <div className="posts-header">
        <h1>{t('posts.title')}</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/generate')} className="btn-create">{t('posts.createNew')}</button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="posts-filter-bar">
        <div className="posts-search-wrap">
          <svg className="posts-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="posts-search-input"
            placeholder={t('posts.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="posts-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
          )}
        </div>

        <select
          className="posts-filter-select"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
        >
          <option value="all">{t('posts.allPlatforms')}</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">Twitter</option>
        </select>

        <select
          className="posts-filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">{t('posts.allStatuses')}</option>
          <option value="draft">{t('posts.draft')}</option>
          <option value="scheduled">{t('posts.scheduled')}</option>
          <option value="ready_to_post">{t('posts.readyToPost')}</option>
          <option value="posted">{t('posts.posted')}</option>
        </select>

        {hasActiveFilter && (
          <button className="posts-filter-clear" onClick={clearFilters}>
            {t('posts.clearFilters')}
          </button>
        )}
      </div>

      {hasActiveFilter && (
        <p className="posts-result-count">
          {t('posts.resultCount', { filtered: filtered.length, total: posts.length })}
        </p>
      )}

      {posts.length === 0 ? (
        <div className="empty-state">
          <p>{t('posts.noPosts')}</p>
          <button className="btn-create" onClick={() => navigate('/generate')}>{t('posts.createFirst')}</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>{t('posts.noMatch')}</p>
          <button className="btn-back" onClick={clearFilters}>{t('posts.clearFilters')}</button>
        </div>
      ) : (
        <div className="posts-grid">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="post-item"
              onClick={() => navigate(`/edit/${post.id}`)}
            >
              <div className="post-item-header">
                <div className="post-platform">
                  {PLATFORM_LABELS[post.platform] || post.platform}
                </div>
                {getStatusBadge(post.status)}
              </div>

              <div className="post-caption">
                {post.caption.length > 100 ? post.caption.substring(0, 100) + '...' : post.caption}
              </div>

              <div className="post-hashtags">{post.hashtags}</div>

              {post.image_prompt && (
                <div className="post-image-prompt">
                  {post.image_prompt.length > 80 ? post.image_prompt.substring(0, 80) + '...' : post.image_prompt}
                </div>
              )}

              <div className="post-meta">
                <span>📅 {formatDate(post.scheduled_time)}</span>
              </div>

              <div className="post-actions">
                <button
                  className="btn-edit"
                  onClick={(e) => { e.stopPropagation(); navigate(`/edit/${post.id}`); }}
                >
                  {t('posts.edit')}
                </button>
                <button className="btn-delete" onClick={(e) => handleDelete(e, post.id)}>
                  {t('posts.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PostsList;
```

---

## frontend/src/components/CreatePost.jsx

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/CreatePost.css';

function CreatePost() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [status, setStatus] = useState('draft');
  const [scheduledTime, setScheduledTime] = useState('');

  const [tone, setTone] = useState('professional');
  const [polishing, setPolishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handlePolish = async () => {
    if (!caption.trim()) {
      setError(t('create.captionRequiredPolish'));
      return;
    }
    setPolishing(true);
    setError('');
    try {
      const res = await aiAPI.polishContent({ caption, hashtags, image_prompt: imagePrompt, platform, tone });
      setCaption(res.data.caption);
      setHashtags(res.data.hashtags);
      if (res.data.image_prompt) setImagePrompt(res.data.image_prompt);
    } catch {
      setError(t('create.failedPolish'));
    } finally {
      setPolishing(false);
    }
  };

  const handleSave = async () => {
    if (!caption.trim()) {
      setError(t('create.captionRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await postsAPI.create({ caption, hashtags, tone, image_prompt: imagePrompt, platform, status, scheduled_time: scheduledTime || null });
      setSuccessMsg(t('create.savedMsg'));
      setTimeout(() => navigate('/posts'), 1500);
    } catch {
      setError(t('create.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="create-container">
      <div className="create-header">
        <div>
          <h1>{t('create.title')}</h1>
          <p className="create-subtitle">{t('create.subtitle')}</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {successMsg && <div className="success-message">{successMsg}</div>}

      <div className="create-card">
        <div className="card-title">
          <span className="card-title-icon">📝</span>
          {t('create.content')}
        </div>

        <div className="create-form-row">
          <div className="create-form-group">
            <label>{t('create.platform')}</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>
          <div className="create-form-group">
            <label>{t('create.tone')}</label>
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="professional">{t('create.professional')}</option>
              <option value="casual">{t('create.casual')}</option>
              <option value="funny">{t('create.funny')}</option>
              <option value="inspirational">{t('create.inspirational')}</option>
            </select>
          </div>
        </div>

        <div className="create-form-group">
          <label>{t('create.caption')} <span className="label-required">*</span></label>
          <textarea
            rows={6}
            placeholder={t('create.captionPlaceholder')}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        <div className="create-form-group">
          <label>{t('create.hashtags')}</label>
          <input
            type="text"
            placeholder={t('create.hashtagsPlaceholder')}
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
          />
        </div>

        <div className="create-form-group">
          <label>{t('create.imagePrompt')} <span className="label-optional">{t('create.optional')}</span></label>
          <textarea
            rows={3}
            placeholder={t('create.imagePromptPlaceholder')}
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
          />
        </div>

        <button className="btn-ai-assist" onClick={handlePolish} disabled={polishing}>
          {polishing ? (
            <><span className="btn-spinner" /> {t('common.polishing')}</>
          ) : (
            <>{t('common.polishWithAI')}</>
          )}
        </button>
      </div>

      <div className="create-card">
        <div className="card-title">
          <span className="card-title-icon">⚙️</span>
          {t('create.postSettings')}
        </div>

        <div className="create-form-row">
          <div className="create-form-group">
            <label>{t('create.status')}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">{t('create.draft')}</option>
              <option value="scheduled">{t('create.scheduled')}</option>
              <option value="ready_to_post">{t('create.readyToPost')}</option>
              <option value="posted">{t('create.posted')}</option>
            </select>
          </div>
          <div className="create-form-group">
            <label>{t('create.scheduledTime')} <span className="label-optional">{t('create.optional')}</span></label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>
        </div>

        <button className="btn-save-post" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('create.savePost')}
        </button>
      </div>
    </div>
  );
}

export default CreatePost;
```

---

## frontend/src/components/EditPost.jsx

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/EditPost.css';

function EditPost() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    caption: '',
    hashtags: '',
    image_prompt: '',
    image_url: '',
    platform: 'instagram',
    status: 'draft',
    scheduled_time: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadPost = useCallback(async () => {
    try {
      const response = await postsAPI.getOne(id);
      const post = response.data;
      setFormData({
        caption: post.caption || '',
        hashtags: post.hashtags || '',
        image_prompt: post.image_prompt || '',
        image_url: post.image_url || '',
        platform: post.platform || 'instagram',
        status: post.status || 'draft',
        scheduled_time: (() => {
          if (!post.scheduled_time) return '';
          try {
            const d = new Date(post.scheduled_time);
            return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
          } catch {
            return '';
          }
        })(),
      });
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/posts');
      } else {
        setError(t('edit.failedLoad'));
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const dataToSend = {
        ...formData,
        scheduled_time: formData.scheduled_time || null,
      };
      await postsAPI.update(id, dataToSend);
      setSuccessMsg(t('edit.savedMsg'));
      setTimeout(() => navigate('/posts'), 1500);
    } catch (err) {
      setError(err.message || t('edit.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="edit-post-container">
        <div className="loading">{t('edit.loading')}</div>
      </div>
    );
  }

  return (
    <div className="edit-post-container">
      <div className="edit-post-header">
        <button className="edit-back-btn" onClick={() => navigate('/posts')}>
          {t('edit.back')}
        </button>
        <h2>{t('edit.title')}{id}</h2>
      </div>

      <div className="edit-post-card">
        {error && <div className="error-message">{error}</div>}
        {successMsg && <div className="success-message">{successMsg}</div>}

        {formData.image_url && (
          <div className="edit-post-image">
            <img src={formData.image_url} alt="Post visual" />
          </div>
        )}

        <div className="edit-form-group">
          <label>{t('edit.caption')}</label>
          <textarea
            name="caption"
            value={formData.caption}
            onChange={handleChange}
            rows={5}
          />
        </div>

        <div className="edit-form-group">
          <label>{t('edit.hashtags')}</label>
          <input
            type="text"
            name="hashtags"
            value={formData.hashtags}
            onChange={handleChange}
            placeholder="#hashtag1 #hashtag2"
          />
        </div>

        <div className="edit-form-group">
          <label>{t('edit.imagePrompt')}</label>
          <textarea
            name="image_prompt"
            value={formData.image_prompt}
            onChange={handleChange}
            rows={3}
            placeholder="Image generation prompt..."
          />
        </div>

        <div className="edit-form-row">
          <div className="edit-form-group">
            <label>{t('edit.platform')}</label>
            <select name="platform" value={formData.platform} onChange={handleChange}>
              <option value="instagram">Instagram</option>
              <option value="linkedin">LinkedIn</option>
              <option value="twitter">Twitter</option>
            </select>
          </div>

          <div className="edit-form-group">
            <label>{t('edit.status')}</label>
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="draft">{t('edit.draft')}</option>
              <option value="scheduled">{t('edit.scheduled')}</option>
              <option value="ready_to_post">{t('edit.readyToPost')}</option>
              <option value="posted">{t('edit.posted')}</option>
            </select>
          </div>
        </div>

        <div className="edit-form-group">
          <label>{t('edit.scheduledTime')}</label>
          <input
            type="datetime-local"
            name="scheduled_time"
            value={formData.scheduled_time}
            onChange={handleChange}
          />
        </div>

        <div className="edit-form-actions">
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? t('edit.saving') : t('edit.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditPost;
```

---

## frontend/src/components/ContentGenerator.jsx

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import '../styles/ContentGenerator.css';

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const { t } = useTranslation();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button className={`btn-copy${copied ? ' btn-copy--done' : ''}`} onClick={handleCopy} title={t('generate.copy')}>
            {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
            )}
            {copied ? t('generate.copied') : t('generate.copy')}
        </button>
    );
}

function ContentGenerator() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        topic: '',
        platform: 'instagram',
        tone: 'professional'
    });
    const [generatedContent, setGeneratedContent] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGenerate = async () => {
        if (!formData.topic.trim()) {
            setError(t('generate.topicRequired'));
            return;
        }
        setLoading(true);
        setError('');
        setGeneratedContent(null);
        setImageUrl(null);
        setDownloading(false);

        try {
            const response = await aiAPI.generateContent(formData);
            setGeneratedContent(response.data);
            setImageLoading(true);
            try {
                const imgRes = await aiAPI.generateImage(formData.topic, formData.platform);
                setImageUrl(imgRes.data.image_url);
            } catch {
            } finally {
                setImageLoading(false);
            }
        } catch (err) {
            setError(t('generate.failedGenerate'));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAsDraft = async () => {
        if (!generatedContent) return;
        setSaving(true);
        setError('');

        try {
            await postsAPI.create({
                caption: generatedContent.caption,
                hashtags: generatedContent.hashtags,
                topic: formData.topic,
                tone: formData.tone,
                image_prompt: generatedContent.image_prompt || '',
                image_url: imageUrl || '',
                platform: formData.platform,
                status: 'draft',
            });
            setSuccessMsg(t('generate.savedDraft'));
            setTimeout(() => navigate('/posts'), 1500);
        } catch (err) {
            setError(t('generate.failedSave'));
        } finally {
            setSaving(false);
        }
    };

    const handleDownload = async () => {
        if (!imageUrl) return;
        setDownloading(true);
        try {
            const res = await fetch(imageUrl);
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = 'post-image.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch {
            setError(t('generate.failedDownload'));
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="generator-container">
            <div className="generator-header">
                <button className="generator-back-btn" onClick={() => navigate('/dashboard')}>
                    {t('generate.back')}
                </button>
                <div className="generator-header-text">
                    <h2>{t('generate.title')}</h2>
                    <p>{t('generate.subtitle')}</p>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {successMsg && <div className="success-message">{successMsg}</div>}

            <div className="generator-form-card">
                <div className="gen-form-group">
                    <label>{t('generate.topic')}</label>
                    <input
                        type="text"
                        name="topic"
                        placeholder={t('generate.topicPlaceholder')}
                        value={formData.topic}
                        onChange={handleChange}
                    />
                </div>

                <div className="gen-form-row">
                    <div className="gen-form-group">
                        <label>{t('generate.platform')}</label>
                        <select name="platform" value={formData.platform} onChange={handleChange}>
                            <option value="instagram">Instagram</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="twitter">Twitter</option>
                        </select>
                    </div>

                    <div className="gen-form-group">
                        <label>{t('generate.tone')}</label>
                        <select name="tone" value={formData.tone} onChange={handleChange}>
                            <option value="professional">{t('generate.professional')}</option>
                            <option value="casual">{t('generate.casual')}</option>
                            <option value="funny">{t('generate.funny')}</option>
                            <option value="inspirational">{t('generate.inspirational')}</option>
                        </select>
                    </div>
                </div>

                <button className="btn-generate" onClick={handleGenerate} disabled={loading}>
                    {loading ? t('generate.generating') : t('generate.button')}
                </button>
            </div>

            {generatedContent && (
                <div className="generator-results-card">
                    <h3>{t('generate.results')}</h3>

                    <div className="gen-result-block">
                        <div className="gen-result-label-row">
                            <strong>{t('generate.caption')}</strong>
                            <CopyButton text={generatedContent.caption} />
                        </div>
                        <p>{generatedContent.caption}</p>
                    </div>

                    <div className="gen-result-block">
                        <div className="gen-result-label-row">
                            <strong>{t('generate.hashtags')}</strong>
                            <CopyButton text={generatedContent.hashtags} />
                        </div>
                        <p>{generatedContent.hashtags}</p>
                    </div>

                    <div className="gen-result-block">
                        <div className="gen-result-label-row">
                            <strong>{t('generate.imagePrompt')}</strong>
                            <CopyButton text={generatedContent.image_prompt} />
                        </div>
                        <p>{generatedContent.image_prompt}</p>
                        {imageLoading && <p className="gen-image-status">{t('generate.generatingImage')}</p>}
                        {!imageLoading && imageUrl && (
                            <>
                                <img src={imageUrl} alt="AI generated" className="gen-result-image" />
                                <button className="btn-download-image" onClick={handleDownload} disabled={downloading}>
                                    {downloading ? t('generate.downloading') : t('generate.download')}
                                </button>
                            </>
                        )}
                        {!imageLoading && !imageUrl && <p className="gen-image-status gen-image-error">{t('generate.imageFailed')}</p>}
                    </div>

                    <div className="gen-actions">
                        <button className="btn-save-draft" onClick={handleSaveAsDraft} disabled={saving}>
                            {saving ? t('generate.saving') : t('generate.saveAsDraft')}
                        </button>
                        <button
                            className="btn-generate-new"
                            onClick={() => { setGeneratedContent(null); setImageUrl(null); setFormData({ topic: '', platform: 'instagram', tone: 'professional' }); }}
                        >
                            {t('generate.generateNew')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ContentGenerator;
```

---

## frontend/src/components/Calendar.jsx

(See full file in previous session — no changes from the original. Key points: uses calendarAPI.getMonthPosts, PostModal sub-component, navigation to /generate for new posts, /edit/:id for editing.)

---

## frontend/src/components/NotFound.jsx

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import '../styles/NotFound.css';

function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isLoggedIn = localStorage.getItem('token');

  const handleGoBack = () => {
    if (isLoggedIn) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="not-found">
      <h1 className="not-found__code">404</h1>
      <h2 className="not-found__title">{t('notFound.title')}</h2>
      <p className="not-found__message">{t('notFound.message')}</p>
      <button className="not-found__btn" onClick={handleGoBack}>
        {isLoggedIn ? t('notFound.goToDashboard') : t('notFound.goToLogin')}
      </button>
    </div>
  );
}

export default NotFound;
```
