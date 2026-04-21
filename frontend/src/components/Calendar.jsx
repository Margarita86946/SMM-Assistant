import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import { useActiveClient } from '../context/ActiveClientContext';
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


function PostModal({ post, onClose, onEdit, onReschedule }) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 180);
  }, [onClose]);

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

  const isPosted = post.status === 'posted';

  // Re-evaluate "is past?" on each render tick so it stays accurate while modal is open
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const isPast = post.scheduled_time
    ? new Date(post.scheduled_time) < now
    : false;
  const todayInputMin = `${todayStart.getFullYear()}-${String(todayStart.getMonth()+1).padStart(2,'0')}-${String(todayStart.getDate()).padStart(2,'0')}`;
  const nowTimeMin = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleErr, setRescheduleErr] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  useEffect(() => {
    if (post.scheduled_time) {
      const dt = new Date(post.scheduled_time);
      setNewDate(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
      setNewTime(`${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`);
    }
  }, [post.scheduled_time]);

  const handleBackdrop = (e) => { if (e.target === e.currentTarget) close(); };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  const handleConfirmReschedule = async () => {
    if (!newDate || !newTime) return;
    setRescheduleErr('');
    const [yr, mo, dy] = newDate.split('-').map(Number);
    const [hr, mn] = newTime.split(':').map(Number);
    const scheduled = new Date(yr, mo - 1, dy, hr, mn, 0);
    if (scheduled <= new Date()) {
      setRescheduleErr(t('calendar.mustBeFuture'));
      return;
    }
    setRescheduleLoading(true);
    try {
      // Also set status to 'scheduled' so a draft/approved post is properly marked
      await onReschedule(post.id, scheduled.toISOString(), 'scheduled');
      close();
    } catch {
      setRescheduleErr(t('calendar.rescheduleFailed'));
      setRescheduleLoading(false);
    }
  };

  return (
    <div className={`cal-modal-backdrop${closing ? ' cal-modal-backdrop--closing' : ''}`} onClick={handleBackdrop}>
      <div className={`cal-modal${closing ? ' cal-modal--closing' : ''}`}>
        <div className="cal-modal-header">
          <div className="cal-modal-platform">
            <span className="cal-modal-platform-icon">{platform.icon}</span>
            <span className="cal-modal-platform-label">{platform.label}</span>
            <span className={`status-badge ${statusCls}`}>{statusText}</span>
          </div>
          <button className="cal-modal-close" onClick={close} aria-label="Close">
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
            <div className="cal-modal-date-row">
              <p className="cal-modal-value cal-modal-date">
                {formatFullDate(post.scheduled_time, locale) || t('calendar.notScheduled')}
              </p>
              {!isPosted && (
                isPast ? (
                  <span className="cal-modal-locked-badge" title="Past posts cannot be rescheduled">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    {t('calendar.past')}
                  </span>
                ) : (
                  <button
                    className={`cal-modal-reschedule-btn${rescheduling ? ' cal-modal-reschedule-btn--active' : ''}`}
                    onClick={() => setRescheduling(r => !r)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    {t('calendar.reschedule')}
                  </button>
                )
              )}
            </div>

            {rescheduling && (
              <div className="cal-modal-reschedule-form">
                <div className="cal-modal-reschedule-inputs">
                  <input
                    type="date"
                    value={newDate}
                    min={todayInputMin}
                    onChange={e => setNewDate(e.target.value)}
                    className="cal-drawer-time-input"
                  />
                  <input
                    type="time"
                    value={newTime}
                    min={newDate === todayInputMin ? nowTimeMin : undefined}
                    onChange={e => setNewTime(e.target.value)}
                    className="cal-drawer-time-input"
                  />
                </div>
                {rescheduleErr && <p className="cal-drawer-err">{rescheduleErr}</p>}
                <div className="cal-modal-reschedule-actions">
                  <button
                    className="cal-drawer-confirm"
                    style={{ flex: 1 }}
                    onClick={handleConfirmReschedule}
                    disabled={!newDate || !newTime || rescheduleLoading}
                  >
                    {rescheduleLoading ? <><span className="cal-drawer-confirm-spinner" /> {t('calendar.saving')}</> : t('calendar.confirm')}
                  </button>
                  <button className="cal-modal-cancel-btn" onClick={() => setRescheduling(false)}>
                    {t('calendar.cancel')}
                  </button>
                </div>
              </div>
            )}
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
          {!isPosted && (
            <button
              className="cal-modal-edit-btn"
              onClick={() => { close(); setTimeout(() => onEdit(post.id), 180); }}
              disabled={isPast}
              title={isPast ? 'Past posts cannot be edited' : undefined}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {isPast ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    width="13" height="13">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Past post
                </>
              ) : t('calendar.editPost')}
            </button>
          )}
          <button className="cal-modal-cancel-btn" onClick={close}>{t('calendar.close')}</button>
        </div>
      </div>
    </div>
  );
}

function ScheduleDrawer({ dateKey, locale, onClose, onScheduled }) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose]);

  const [search, setSearch] = useState('');
  const [approvedPosts, setApprovedPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [time, setTime] = useState('09:00');
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    postsAPI.getAll({ status: 'approved', page_size: 50 })
      .then(res => {
        setApprovedPosts(res.data.results ?? []);
        setHasMore(!!res.data.next);
      })
      .catch(() => setErr('Failed to load posts.'))
      .finally(() => setLoadingPosts(false));
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  const displayDate = new Date(dateKey + 'T12:00:00').toLocaleDateString(locale, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const filtered = approvedPosts.filter(p =>
    p.caption.toLowerCase().includes(search.toLowerCase()) ||
    (p.topic || '').toLowerCase().includes(search.toLowerCase()) ||
    p.platform.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selectedPost) return;
    setErr('');
    const [yr, mo, dy] = dateKey.split('-').map(Number);
    const [hr, mn] = time.split(':').map(Number);
    const localDt = new Date(yr, mo - 1, dy, hr, mn, 0);
    if (localDt <= new Date()) {
      setErr(t('calendar.mustBeFuture'));
      return;
    }
    setConfirming(true);
    try {
      await postsAPI.update(selectedPost.id, {
        scheduled_time: localDt.toISOString(),
        status: 'scheduled',
      });
      onScheduled();
    } catch {
      setErr(t('calendar.rescheduleFailed'));
      setConfirming(false);
    }
  };

  return (
    <>
      <div className={`cal-drawer-backdrop${closing ? ' cal-drawer-backdrop--closing' : ''}`} onClick={close} />
      <div className={`cal-drawer${closing ? ' cal-drawer--closing' : ''}`} role="dialog" aria-modal="true">
        <div className="cal-drawer-header">
          <div>
            <p className="cal-drawer-suptitle">{t('calendar.scheduleDrawerTitle')}</p>
            <h3 className="cal-drawer-title">{displayDate}</h3>
          </div>
          <button className="cal-modal-close" onClick={close} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="cal-drawer-search-wrap">
          <svg className="cal-drawer-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder={t('calendar.searchApproved')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="cal-drawer-search-input"
          />
          {search && (
            <button className="cal-drawer-search-clear" onClick={() => setSearch('')}>×</button>
          )}
        </div>

        <div className="cal-drawer-list">
          {loadingPosts ? (
            <div className="cal-drawer-spinner" />
          ) : filtered.length === 0 ? (
            <div className="cal-drawer-empty">
              {approvedPosts.length === 0 ? (
                <>{t('calendar.noApprovedYet')}<br /><span>{t('calendar.noApprovedHint')}</span></>
              ) : (
                t('calendar.noPostsMatch')
              )}
            </div>
          ) : (
            <>
              {filtered.map(post => {
                const pm = PLATFORM_META[post.platform] || { icon: '📄' };
                const isSelected = selectedPost?.id === post.id;
                return (
                  <button
                    key={post.id}
                    className={`cal-drawer-post${isSelected ? ' cal-drawer-post--selected' : ''}`}
                    onClick={() => setSelectedPost(isSelected ? null : post)}
                  >
                    <span className="cal-drawer-post-icon">{pm.icon}</span>
                    <div className="cal-drawer-post-body">
                      {post.topic && <p className="cal-drawer-post-topic">{post.topic}</p>}
                      <p className="cal-drawer-post-caption">
                        {post.caption.length > 90 ? post.caption.slice(0, 90) + '…' : post.caption}
                      </p>
                    </div>
                    {isSelected && (
                      <svg className="cal-drawer-post-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                );
              })}
              {hasMore && !search && (
                <p className="cal-drawer-has-more">{t('calendar.showingFirst50')}</p>
              )}
            </>
          )}
        </div>

        <div className="cal-drawer-footer">
          {err && <p className="cal-drawer-err">{err}</p>}
          <div className="cal-drawer-time-row">
            <label className="cal-drawer-time-label">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {t('calendar.publishTime')}
            </label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="cal-drawer-time-input"
            />
          </div>
          <button
            className="cal-drawer-confirm"
            onClick={handleConfirm}
            disabled={!selectedPost || confirming}
          >
            {confirming ? (
              <><span className="cal-drawer-confirm-spinner" /> {t('calendar.scheduling')}</>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {t('calendar.confirmSchedule')}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function Calendar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useSettings();
  const locale = LOCALE_MAP[language] || 'en-US';
  const today = new Date();
  const { activeClientId, activeClient } = useActiveClient();

  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dropError, setDropError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [scheduleDrawer, setScheduleDrawer] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [dragOverNav, setDragOverNav] = useState(null); // 'prev' | 'next' | null
  const [navPortalKey, setNavPortalKey] = useState(0); // bumped each time portal countdown restarts
  const [rejectPostId, setRejectPostId] = useState(null);
  const [rejectCellKey, setRejectCellKey] = useState(null);
  const [flashKey, setFlashKey] = useState(0);
  const pendingFlash = useRef(false);
  const navHoverTimer = useRef(null);
  const dragMonthRef = useRef({ month: 0, year: 0 });
  const originMonthRef = useRef(null);    // month/year when drag started
  const dropSucceededRef = useRef(false); // true only when drop was accepted
  const docDragEndRef = useRef(null);     // document-level dragend listener (source may unmount)
  const draggingRef = useRef(null);       // always-current ref — avoids stale closure in handlers

  const month = currentDate.getMonth() + 1;
  const year  = currentDate.getFullYear();

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await calendarAPI.getMonthPosts(month, year, activeClientId);
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
  }, [month, year, activeClientId]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Keep a ref so the nav-portal timer can read current month/year without stale closure
  useEffect(() => { dragMonthRef.current = { month, year }; }, [month, year]);

  useEffect(() => {
    if (flashKey === 0) return;
    const el = document.getElementById('cal-today-cell');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [flashKey]);

  const daysInMonth   = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const postsByDay = {};
  posts.forEach((post) => {
    if (!post.scheduled_time) return;
    const d = new Date(post.scheduled_time);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!postsByDay[key]) postsByDay[key] = [];
    postsByDay[key].push(post);
  });

  // Build a deduplicated list of clients present in this month's posts (for legend)
  const clientsInMonth = !activeClientId ? (() => {
    const seen = new Map();
    posts.forEach(p => {
      if (p.client_username && !seen.has(p.client)) {
        seen.set(p.client, {
          id: p.client,
          name: p.client_first_name || p.client_last_name
            ? [p.client_first_name, p.client_last_name].filter(Boolean).join(' ')
            : p.client_username,
          initial: (p.client_first_name || p.client_username || '').charAt(0).toUpperCase(),
        });
      }
    });
    return Array.from(seen.values());
  })() : [];

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

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e, post) => {
    draggingRef.current = post;
    setDragging(post);
    originMonthRef.current = { ...dragMonthRef.current };
    dropSucceededRef.current = false;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('postId', String(post.id));

    // Build a clean ghost image — no hover scale, full opacity
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const clone = el.cloneNode(true);
    clone.style.cssText = [
      'position:fixed', 'top:-9999px', 'left:-9999px',
      `width:${rect.width}px`, 'transform:none', 'opacity:1',
      'pointer-events:none', 'margin:0',
    ].join(';');
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top);
    setTimeout(() => document.body.removeChild(clone), 0);
  }, []);

  const handleDragEnd = useCallback((e) => {
    // Don't null the ref here — handleDrop reads it and may not have fired yet
    // (some browsers fire dragend before drop in edge cases)
    setTimeout(() => {
      draggingRef.current = null;
      setDragging(null);
    }, 0);
    setDragOverKey(null);
    setDragOverNav(null);
    if (navHoverTimer.current) {
      clearTimeout(navHoverTimer.current.id);
      navHoverTimer.current = null;
    }
    if (docDragEndRef.current) {
      document.removeEventListener('dragend', docDragEndRef.current);
      docDragEndRef.current = null;
    }
    if (!dropSucceededRef.current && originMonthRef.current) {
      const { month: om, year: oy } = originMonthRef.current;
      const { month: cm, year: cy } = dragMonthRef.current;
      if (om !== cm || oy !== cy) {
        setPosts([]);
        setCurrentDate(new Date(oy, om - 1, 1));
      }
    }
    originMonthRef.current = null;
    dropSucceededRef.current = false;
  }, []);

  const handleDragOver = useCallback((e, dateKey) => {
    e.preventDefault();
    // Block drops on past dates
    if (dateKey < todayKey) {
      e.dataTransfer.dropEffect = 'none';
      setDragOverKey(null);
      return;
    }
    e.dataTransfer.dropEffect = 'move';
    setDragOverKey(dateKey);
  }, [todayKey]);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverKey(null);
    }
  }, []);

  const handleDrop = useCallback(async (e, targetDateKey) => {
    e.preventDefault();
    setDragOverKey(null);

    const post = draggingRef.current;
    console.log('[drop] targetDateKey=', targetDateKey, 'post=', post?.id, post?.scheduled_time);
    if (!post) { console.warn('[drop] draggingRef is null — drop ignored'); return; }

    // Compute source key using local date (same as cell keys)
    const srcDate = post.scheduled_time ? new Date(post.scheduled_time) : null;
    const sourceKey = srcDate
      ? `${srcDate.getFullYear()}-${String(srcDate.getMonth()+1).padStart(2,'0')}-${String(srcDate.getDate()).padStart(2,'0')}`
      : null;

    if (sourceKey === targetDateKey) {
      draggingRef.current = null;
      setDragging(null);
      return;
    }

    // Preserve local hours:minutes so time-of-day is kept after rescheduling
    const th   = srcDate ? srcDate.getHours()   : 9;
    const tmin = srcDate ? srcDate.getMinutes() : 0;

    const [ty, tm, td] = targetDateKey.split('-').map(Number);
    const prospective = new Date(ty, tm - 1, td, th, tmin, 0);

    if (prospective <= new Date()) {
      // Snap-back: flash the forbidden cell and shake the chip back to its origin
      setRejectCellKey(targetDateKey);
      setRejectPostId(post.id);
      setDropError("Can't reschedule to a past date or time.");
      draggingRef.current = null;
      setDragging(null);
      setTimeout(() => {
        setRejectCellKey(null);
        setRejectPostId(null);
        setDropError('');
      }, 600);
      return;
    }

    const newScheduledTime = prospective.toISOString();

    // Mark success before the await — dragend fires while we're still awaiting
    dropSucceededRef.current = true;

    // Optimistic update: move the chip immediately, no refresh needed
    console.log('[drop] optimistic update → moving post', post.id, 'to', newScheduledTime);
    setPosts(prev => prev.map(p =>
      p.id === post.id ? { ...p, scheduled_time: newScheduledTime } : p
    ));
    draggingRef.current = null;
    setDragging(null);

    try {
      await postsAPI.update(post.id, { scheduled_time: newScheduledTime });
      console.log('[drop] API success');
    } catch (err) {
      console.error('[drop] API error — reverting', err);
      dropSucceededRef.current = false;
      setDropError('Failed to move post. Reverting…');
      setTimeout(() => setDropError(''), 4000);
      loadPosts();
    }
  }, [loadPosts]);

  // ── Nav-arrow portal: hover for 500ms while dragging → flip month ─────────

  const handleNavDragOver = useCallback((e, direction) => {
    if (!dragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none'; // don't allow drop ON the arrow itself

    // If already counting down for this direction, do nothing
    if (navHoverTimer.current?.direction === direction) return;

    // Direction changed: cancel the old timer
    if (navHoverTimer.current) {
      clearTimeout(navHoverTimer.current.id);
    }

    setDragOverNav(direction);
    setNavPortalKey(k => k + 1); // force CSS animation to restart from 0%

    const timerId = setTimeout(() => {
      navHoverTimer.current = null;
      setDragOverNav(null);
      const { month: m, year: y } = dragMonthRef.current;

      // Capture snap-back target before navigating away
      const snapTo = { month: m, year: y };

      // Document-level dragend fires even if the source chip unmounts
      if (docDragEndRef.current) {
        document.removeEventListener('dragend', docDragEndRef.current);
      }
      const docListener = () => {
        document.removeEventListener('dragend', docListener);
        docDragEndRef.current = null;
        if (!dropSucceededRef.current) {
          setPosts([]);
          setCurrentDate(new Date(snapTo.year, snapTo.month - 1, 1));
        }
        dropSucceededRef.current = false;
        originMonthRef.current = null;
      };
      docDragEndRef.current = docListener;
      document.addEventListener('dragend', docListener);

      setPosts([]);
      setCurrentDate(direction === 'prev'
        ? new Date(y, m - 2, 1)
        : new Date(y, m,     1));
    }, 500);

    navHoverTimer.current = { id: timerId, direction };
  }, [dragging]);

  const handleNavDragLeave = useCallback(() => {
    setDragOverNav(null);
    if (navHoverTimer.current) {
      clearTimeout(navHoverTimer.current.id);
      navHoverTimer.current = null;
    }
  }, []);

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

      {activeClient && (
        <div className="cal-client-banner">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          {t('calendar.filteredBy', { name: [activeClient.first_name, activeClient.last_name].filter(Boolean).join(' ') || activeClient.username })}
        </div>
      )}

      {error    && <div className="error-message">{t(error)}</div>}
      {dropError && <div className="error-message">{dropError}</div>}

      <div className="cal-card">
        <div className="cal-nav">
          <div className="cal-nav-left">
            <button
              className={`cal-nav-btn${dragOverNav === 'prev' ? ' cal-nav-btn--drag-portal' : ''}`}
              data-portal-key={dragOverNav === 'prev' ? navPortalKey : undefined}
              onClick={prevMonth}
              aria-label="Previous month"
              onDragOver={e => handleNavDragOver(e, 'prev')}
              onDragLeave={handleNavDragLeave}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <h2 className="cal-month-label">{monthLabel}</h2>
            <button
              className={`cal-nav-btn${dragOverNav === 'next' ? ' cal-nav-btn--drag-portal' : ''}`}
              data-portal-key={dragOverNav === 'next' ? navPortalKey : undefined}
              onClick={nextMonth}
              aria-label="Next month"
              onDragOver={e => handleNavDragOver(e, 'next')}
              onDragLeave={handleNavDragLeave}
            >
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
          <div className={`cal-grid${dragging ? ' cal-grid--dragging' : ''}`}>
            {cells.map((day, idx) => {
              const col = idx % 7;
              if (day === null) {
                return <div key={`blank-${idx}`} className="cal-cell cal-cell--empty" data-col={col} />;
              }
              const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayPosts = postsByDay[key] || [];
              const isToday = key === todayKey;
              const isDragOver = dragOverKey === key;
              const isRejectCell = rejectCellKey === key;
              // Mark cell as forbidden if dropping the dragged chip there would land in the past
              const isPast = dragging && (() => {
                if (key < todayKey) return true;
                if (key === todayKey) {
                  const orig = dragging.scheduled_time ? new Date(dragging.scheduled_time) : null;
                  const h = orig ? orig.getHours() : 9;
                  const m = orig ? orig.getMinutes() : 0;
                  const now2 = new Date();
                  return new Date(now2.getFullYear(), now2.getMonth(), now2.getDate(), h, m, 0) <= now2;
                }
                return false;
              })();

              return (
                <div
                  key={key}
                  id={isToday ? 'cal-today-cell' : undefined}
                  data-col={col}
                  className={[
                    'cal-cell',
                    isToday      ? 'cal-cell--today'     : '',
                    isDragOver   ? 'cal-cell--drag-over' : '',
                    isPast       ? 'cal-cell--past-drop' : '',
                    isRejectCell ? 'cal-cell--reject'    : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setScheduleDrawer(key)}
                  onDragOver={e => handleDragOver(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, key)}
                >
                  {isToday && flashKey > 0 && (
                    <div key={flashKey} className="cal-today-flash-overlay" />
                  )}
                  <div className={`cal-day-num${isToday ? ' cal-day-num--today' : ''}`}>{day}</div>

                  <div className="cal-posts">
                    {dayPosts.map((post) => {
                      const p = PLATFORM_META[post.platform] || { icon: '📄' };
                      const isDraggingThis = dragging?.id === post.id;
                      const isRejectChip = rejectPostId === post.id;
                      const chipPast = post.scheduled_time
                        ? new Date(post.scheduled_time) <= new Date()
                        : false;
                      return (
                        <button
                          key={post.id}
                          draggable={!chipPast}
                          className={[
                            'cal-post-chip',
                            `cal-chip--${post.platform}`,
                            isDraggingThis ? 'cal-chip--dragging' : '',
                            chipPast       ? 'cal-chip--past'     : '',
                            isRejectChip   ? 'cal-chip--reject'   : '',
                          ].filter(Boolean).join(' ')}
                          onDragStart={chipPast ? undefined : e => { e.stopPropagation(); handleDragStart(e, post); }}
                          onDragEnd={chipPast ? undefined : handleDragEnd}
                          onClick={e => { e.stopPropagation(); setSelectedPost(post); }}
                          title={post.caption}
                        >
                          <span className="cal-chip-icon">{p.icon}</span>
                          <span className="cal-chip-time">{formatTime(post.scheduled_time, locale)}</span>
                          {!activeClientId && post.client_username && (
                            <span className="cal-chip-client" title={post.client_first_name || post.client_last_name
                              ? [post.client_first_name, post.client_last_name].filter(Boolean).join(' ')
                              : post.client_username}>
                              {(post.client_first_name || post.client_username || '').charAt(0).toUpperCase()}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* subtle + hint on hover */}
                  <span className="cal-cell-add-hint">+</span>
                </div>
              );
            })}
          </div>
          {loading && <div className="cal-loading-overlay" />}
        </div>
      </div>

      {clientsInMonth.length > 0 && (
        <div className="cal-client-legend">
          <span className="cal-client-legend-label">Clients this month:</span>
          {clientsInMonth.map(c => (
            <div key={c.id} className="cal-client-legend-item">
              <span className="cal-chip-client">{c.initial}</span>
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="cal-legend">
        {Object.entries(PLATFORM_META).map(([key, { icon, label }]) => (
          <div key={key} className="cal-legend-item">
            <span className={`cal-legend-dot cal-chip--${key}`}>{icon}</span>
            <span>{label}</span>
          </div>
        ))}
        <div className="cal-legend-item cal-legend-drag-hint">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            width="14" height="14">
            <polyline points="5 9 2 12 5 15"/>
            <polyline points="9 5 12 2 15 5"/>
            <polyline points="15 19 12 22 9 19"/>
            <polyline points="19 9 22 12 19 15"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="12" y1="2" x2="12" y2="22"/>
          </svg>
          <span>{t('calendar.dragHint')}</span>
        </div>
      </div>

      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onEdit={(id) => { setSelectedPost(null); navigate(`/edit/${id}`); }}
          onReschedule={async (postId, isoTime, newStatus) => {
            const payload = { scheduled_time: isoTime };
            if (newStatus) payload.status = newStatus;
            await postsAPI.update(postId, payload);
            const target = new Date(isoTime);
            const targetYear = target.getFullYear();
            const targetMonth = target.getMonth(); // 0-indexed
            if (targetYear !== year || targetMonth !== month - 1) {
              // Navigate to the month the post moved to — useEffect will reload posts
              setPosts([]);
              setCurrentDate(new Date(targetYear, targetMonth, 1));
            } else {
              loadPosts();
            }
          }}
        />
      )}

      {scheduleDrawer && (
        <ScheduleDrawer
          dateKey={scheduleDrawer}
          locale={locale}
          onClose={() => setScheduleDrawer(null)}
          onScheduled={() => { setScheduleDrawer(null); loadPosts(); }}
        />
      )}
    </div>
  );
}

export default Calendar;
