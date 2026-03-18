import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import '../styles/Calendar.css';

const PLATFORM_META = {
  instagram: { icon: '📷', label: 'Instagram' },
  linkedin:  { icon: '💼', label: 'LinkedIn'  },
  twitter:   { icon: '🐦', label: 'Twitter'   },
};

const STATUS_CLS = {
  draft:         'badge-draft',
  scheduled:     'badge-scheduled',
  ready_to_post: 'badge-ready',
  posted:        'badge-posted',
};

function formatTime(dateStr, locale) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(locale, {
    hour: '2-digit', minute: '2-digit',
  });
}

function formatFullDate(dateStr, locale) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function PostModal({ post, onClose, onEdit }) {
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';
  const platform = PLATFORM_META[post.platform] || { icon: '📄', label: post.platform };
  const statusCls = STATUS_CLS[post.status] || 'badge-draft';
  const statusText = {
    draft: t('posts.draft'),
    scheduled: t('posts.scheduled'),
    ready_to_post: t('posts.ready'),
    posted: t('posts.posted'),
  }[post.status] || post.status;

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="cal-modal-backdrop" onClick={handleBackdrop}>
      <div className="cal-modal">
        <div className="cal-modal-header">
          <div className="cal-modal-platform">
            <span className="cal-modal-platform-icon">{platform.icon}</span>
            <span className="cal-modal-platform-label">{platform.label}</span>
            <span className={`status-badge ${statusCls}`}>{statusText}</span>
          </div>
          <button className="cal-modal-close" onClick={onClose} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="cal-modal-body">
          <div className="cal-modal-section">
            <p className="cal-modal-label">{t('calendar.labelScheduled')}</p>
            <p className="cal-modal-value cal-modal-date">
              {formatFullDate(post.scheduled_time, locale) || t('calendar.notScheduled')}
            </p>
          </div>

          <div className="cal-modal-section">
            <p className="cal-modal-label">{t('calendar.labelCaption')}</p>
            <p className="cal-modal-value cal-modal-caption">{post.caption}</p>
          </div>

          {post.hashtags && (
            <div className="cal-modal-section">
              <p className="cal-modal-label">{t('calendar.labelHashtags')}</p>
              <p className="cal-modal-value cal-modal-hashtags">{post.hashtags}</p>
            </div>
          )}

          {post.image_prompt && (
            <div className="cal-modal-section">
              <p className="cal-modal-label">{t('calendar.labelImagePrompt')}</p>
              <p className="cal-modal-value cal-modal-caption">{post.image_prompt}</p>
            </div>
          )}
        </div>

        <div className="cal-modal-footer">
          <button className="cal-modal-edit-btn" onClick={() => onEdit(post.id)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {t('calendar.editPost')}
          </button>
          <button className="cal-modal-cancel-btn" onClick={onClose}>{t('calendar.close')}</button>
        </div>
      </div>
    </div>
  );
}

function Calendar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';
  const today = new Date();

  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [flashKey, setFlashKey] = useState(0);
  const pendingFlash = useRef(false);

  const month = currentDate.getMonth() + 1;
  const year  = currentDate.getFullYear();

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await calendarAPI.getMonthPosts(month, year);
      setPosts(res.data);
    } catch {
      setError('calendar.failedLoad');
    } finally {
      setLoading(false);
      if (pendingFlash.current) {
        pendingFlash.current = false;
        setFlashKey(k => k + 1);
      }
    }
  }, [month, year]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (flashKey === 0) return;
    const el = document.getElementById('cal-today-cell');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [flashKey]);

  const daysInMonth  = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const postsByDay = {};
  posts.forEach((post) => {
    if (!post.scheduled_time) return;
    const key = post.scheduled_time.slice(0, 10);
    if (!postsByDay[key]) postsByDay[key] = [];
    postsByDay[key].push(post);
  });

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const DAYS_OF_WEEK = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'].map(k => t(`calendar.${k}`));

  const prevMonth = () => { setPosts([]); setCurrentDate(new Date(year, month - 2, 1)); };
  const nextMonth = () => { setPosts([]); setCurrentDate(new Date(year, month, 1)); };
  const goToday   = () => {
    if (year !== today.getFullYear() || month !== today.getMonth() + 1) {
      pendingFlash.current = true;
      setPosts([]);
      setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    } else {
      setFlashKey(k => k + 1);
    }
  };

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handlePostClick = (e, post) => {
    e.stopPropagation();
    setSelectedPost(post);
  };

  return (
    <div className="cal-container">

      <div className="cal-page-header">
        <div>
          <h1>{t('calendar.title')}</h1>
          <p className="cal-subtitle">{t('calendar.subtitle')}</p>
        </div>
        <button className="cal-new-btn" onClick={() => navigate('/generate')}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('calendar.newPost')}
        </button>
      </div>

      {error && <div className="error-message">{t(error)}</div>}

      <div className="cal-card">

        <div className="cal-nav">
          <div className="cal-nav-left">
            <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h2 className="cal-month-label">{monthLabel}</h2>
            <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
          <div className="cal-nav-right">
            <span className="cal-post-count">{t('calendar.postsThisMonth', { count: posts.length })}</span>
            <button className="cal-today-btn" onClick={goToday}>{t('calendar.today')}</button>
          </div>
        </div>

        <div className="cal-grid-header">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="cal-dow">{d}</div>
          ))}
        </div>

        <div className={`cal-grid-wrap${loading ? ' cal-grid-wrap--loading' : ''}`}>
          <div className="cal-grid">
            {cells.map((day, idx) => {
              if (day === null) {
                return <div key={`blank-${idx}`} className="cal-cell cal-cell--empty" />;
              }
              const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayPosts = postsByDay[key] || [];
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  id={isToday ? 'cal-today-cell' : undefined}
                  className={`cal-cell${isToday ? ' cal-cell--today' : ''}`}
                >
                  {isToday && flashKey > 0 && (
                    <div key={flashKey} className="cal-today-flash-overlay" />
                  )}
                  <div className={`cal-day-num${isToday ? ' cal-day-num--today' : ''}`}>{day}</div>

                  <div className="cal-posts">
                    {dayPosts.map((post) => {
                      const p = PLATFORM_META[post.platform] || { icon: '📄' };
                      return (
                        <button
                          key={post.id}
                          className={`cal-post-chip cal-chip--${post.platform}`}
                          onClick={(e) => handlePostClick(e, post)}
                          title={post.caption}
                        >
                          <span className="cal-chip-icon">{p.icon}</span>
                          <span className="cal-chip-time">{formatTime(post.scheduled_time, locale)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {loading && <div className="cal-loading-overlay" />}
        </div>
      </div>

      <div className="cal-legend">
        {Object.entries(PLATFORM_META).map(([key, { icon, label }]) => (
          <div key={key} className="cal-legend-item">
            <span className={`cal-legend-dot cal-chip--${key}`}>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onEdit={(id) => { setSelectedPost(null); navigate(`/edit/${id}`); }}
        />
      )}
    </div>
  );
}

export default Calendar;
