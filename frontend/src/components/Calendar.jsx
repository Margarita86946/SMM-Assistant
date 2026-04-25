import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarAPI, postsAPI } from '../services/api';
import { useTranslation } from '../i18n';
import { useSettings, LOCALE_MAP } from '../context/SettingsContext';
import { useActiveClient } from '../context/ActiveClientContext';
import {
  FiX, FiLock, FiRefreshCw, FiEdit2, FiSearch, FiCheck,
  FiClock, FiUser, FiChevronLeft, FiChevronRight, FiMove,
} from 'react-icons/fi';
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
      await onReschedule(post.id, scheduled.toISOString());
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
            <FiX />
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
                    <FiLock />
                    {t('calendar.past')}
                  </span>
                ) : (
                  <button
                    className={`cal-modal-reschedule-btn${rescheduling ? ' cal-modal-reschedule-btn--active' : ''}`}
                    onClick={() => setRescheduling(r => !r)}
                  >
                    <FiRefreshCw />
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
              {isPast ? (
                <><FiLock size={13} /> Past post</>
              ) : (
                <><FiEdit2 /> {t('calendar.editPost')}</>
              )}
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
            <FiX />
          </button>
        </div>

        <div className="cal-drawer-search-wrap">
          <FiSearch className="cal-drawer-search-icon" />
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
                    {isSelected && <FiCheck className="cal-drawer-post-check" />}
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
              <FiClock />
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
              <><FiCheck /> {t('calendar.confirmSchedule')}</>
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
  const [selectedPost, setSelectedPost] = useState(null);
  const [scheduleDrawer, setScheduleDrawer] = useState(null);
  const [flashKey, setFlashKey] = useState(0);
  const [calView, setCalView] = useState('month'); // 'month' | 'week' | 'day'
  const pendingFlash = useRef(false);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [dragging, setDragging]       = useState(null);   // post object being dragged
  const [dragOver, setDragOver]       = useState(null);   // dateKey hovered
  const [dragOverNav, setDragOverNav] = useState(null);   // 'prev' | 'next' | null
  const [navPortalKey, setNavPortalKey] = useState(0);
  const draggingRef    = useRef(null);   // mirror of dragging — readable in async handlers
  const snapshotRef    = useRef([]);     // posts snapshot at drag-start
  const succeededRef   = useRef(false);  // true when a valid drop happened
  const handledRef     = useRef(false);  // prevents double-fire of dragend
  const navTimerRef    = useRef(null);
  const currentDateRef = useRef(currentDate); // always-current currentDate for closures

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
  useEffect(() => { currentDateRef.current = currentDate; }, [currentDate]);

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

  const DAYS_OF_WEEK = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'].map(k => t(`calendar.${k}`));

  const prevPeriod = () => {
    setPosts([]);
    if (calView === 'month') setCurrentDate(new Date(year, month - 2, 1));
    else if (calView === 'week') setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
    else setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() - 1); return d; });
  };
  const nextPeriod = () => {
    setPosts([]);
    if (calView === 'month') setCurrentDate(new Date(year, month, 1));
    else if (calView === 'week') setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
    else setCurrentDate(prev => { const d = new Date(prev); d.setDate(d.getDate() + 1); return d; });
  };
  const goToday = () => {
    const sameMonth = year === today.getFullYear() && month === today.getMonth() + 1;
    if (!sameMonth) {
      pendingFlash.current = true;
      setPosts([]);
    } else {
      setFlashKey(k => k + 1);
    }
    setCurrentDate(calView === 'month'
      ? new Date(today.getFullYear(), today.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), today.getDate())
    );
  };

  // Week view: get the Monday of the week containing currentDate
  const getWeekStart = (d) => {
    const day = new Date(d);
    const dow = day.getDay(); // 0=Sun
    const diff = dow === 0 ? -6 : 1 - dow;
    day.setDate(day.getDate() + diff);
    day.setHours(0, 0, 0, 0);
    return day;
  };

  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const periodLabel = calView === 'month'
    ? currentDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    : calView === 'week'
      ? `${weekDays[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : currentDate.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // A cell is forbidden if its entire day is strictly in the past (before today's date)
  const isCellPast = (dateKey) => dateKey < todayKey;

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const endDrag = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    setDragging(null);
    setDragOver(null);
    setDragOverNav(null);
    draggingRef.current = null;
    if (navTimerRef.current) { clearTimeout(navTimerRef.current); navTimerRef.current = null; }

    if (!succeededRef.current && snapshotRef.current.length > 0) {
      // Restore snapshot instantly
      setPosts(snapshotRef.current);
      // Navigate back to origin month only if we drifted away
      setCurrentDate(prev => {
        const od = snapshotRef.current._originDate;
        if (!od) return prev;
        if (prev.getFullYear() === od.getFullYear() && prev.getMonth() === od.getMonth()) return prev;
        return od;
      });
    }

    snapshotRef.current = [];
    succeededRef.current = false;
    setTimeout(() => { handledRef.current = false; }, 0);
  }, []);

  const onDragStart = useCallback((e, post) => {
    draggingRef.current = post;
    setDragging(post);
    succeededRef.current = false;
    handledRef.current = false;

    // Snapshot current posts + origin month date
    const snap = [...posts];
    snap._originDate = currentDateRef.current;
    snapshotRef.current = snap;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(post.id));

    // Clean ghost image
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const clone = el.cloneNode(true);
    clone.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${rect.width}px;margin:0;pointer-events:none;opacity:1;`;
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, e.clientX - rect.left, e.clientY - rect.top);
    setTimeout(() => document.body.removeChild(clone), 0);

    // Document-level dragend fires even when chip unmounts (cross-month portal)
    const docHandler = () => { document.removeEventListener('dragend', docHandler); endDrag(); };
    document.addEventListener('dragend', docHandler);
  }, [posts, endDrag]);

  const onDragEnd = useCallback(() => { endDrag(); }, [endDrag]);

  const onDragOver = useCallback((e, dateKey) => {
    e.preventDefault();
    if (isCellPast(dateKey)) {
      e.dataTransfer.dropEffect = 'none';
      setDragOver(null);
    } else {
      e.dataTransfer.dropEffect = 'move';
      setDragOver(dateKey);
    }
  }, [todayKey]); // eslint-disable-line

  const onDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  }, []);

  const onDrop = useCallback(async (e, targetKey) => {
    e.preventDefault();
    setDragOver(null);

    const post = draggingRef.current;
    if (!post || isCellPast(targetKey)) return;

    const srcDate = post.scheduled_time ? new Date(post.scheduled_time) : null;
    const srcKey  = srcDate
      ? `${srcDate.getFullYear()}-${String(srcDate.getMonth()+1).padStart(2,'0')}-${String(srcDate.getDate()).padStart(2,'0')}`
      : null;
    if (srcKey === targetKey) return;

    // Keep original time-of-day
    const h  = srcDate ? srcDate.getHours()   : 9;
    const m  = srcDate ? srcDate.getMinutes() : 0;
    const [ty, tm, td] = targetKey.split('-').map(Number);
    const newTime = new Date(ty, tm - 1, td, h, m, 0).toISOString();

    succeededRef.current = true;

    // Optimistic: update or inject
    setPosts(prev => {
      const exists = prev.some(p => p.id === post.id);
      if (exists) return prev.map(p => p.id === post.id ? { ...p, scheduled_time: newTime } : p);
      return [...prev, { ...post, scheduled_time: newTime }];
    });

    try {
      await postsAPI.update(post.id, { scheduled_time: newTime });
    } catch {
      succeededRef.current = false;
      loadPosts();
    }
  }, [loadPosts, todayKey]); // eslint-disable-line

  // Nav portal: hover arrow for 600ms while dragging → flip month
  const onNavDragOver = useCallback((e, dir) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
    if (navTimerRef.current?.dir === dir) return;
    if (navTimerRef.current) { clearTimeout(navTimerRef.current); }
    setDragOverNav(dir);
    setNavPortalKey(k => k + 1);
    const timer = setTimeout(() => {
      navTimerRef.current = null;
      setDragOverNav(null);
      setCurrentDate(prev => {
        const m = prev.getMonth();
        const y = prev.getFullYear();
        return dir === 'prev' ? new Date(y, m - 1, 1) : new Date(y, m + 1, 1);
      });
      setPosts([]);
    }, 600);
    navTimerRef.current = { id: timer, dir };
  }, []);

  const onNavDragLeave = useCallback(() => {
    setDragOverNav(null);
    if (navTimerRef.current) { clearTimeout(navTimerRef.current.id); navTimerRef.current = null; }
  }, []);

  return (
    <div className="cal-container">

      <div className="cal-page-header">
        <div>
          <h1>{t('calendar.title')}</h1>
          <p className="cal-subtitle">{t('calendar.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="cal-new-btn cal-new-btn--outline" onClick={() => navigate('/create')}>
            {t('posts.createManual')}
          </button>
          <button className="cal-new-btn" onClick={() => navigate('/generate')}>
            {t('posts.createNew')}
          </button>
        </div>
      </div>

      {activeClient && (
        <div className="cal-client-banner">
          <FiUser />
          {t('calendar.filteredBy', { name: [activeClient.first_name, activeClient.last_name].filter(Boolean).join(' ') || activeClient.username })}
        </div>
      )}

      {error && <div className="error-message">{t(error)}</div>}

      <div className="cal-card">
        <div className="cal-nav">
          <div className="cal-nav-left">
            <button
              className={`cal-nav-btn${dragOverNav === 'prev' ? ' cal-nav-btn--portal' : ''}`}
              data-portal-key={dragOverNav === 'prev' ? navPortalKey : undefined}
              onClick={prevPeriod}
              aria-label="Previous"
              onDragOver={e => onNavDragOver(e, 'prev')}
              onDragLeave={onNavDragLeave}
            >
              <FiChevronLeft />
            </button>
            <h2 className="cal-month-label">{periodLabel}</h2>
            <button
              className={`cal-nav-btn${dragOverNav === 'next' ? ' cal-nav-btn--portal' : ''}`}
              data-portal-key={dragOverNav === 'next' ? navPortalKey : undefined}
              onClick={nextPeriod}
              aria-label="Next"
              onDragOver={e => onNavDragOver(e, 'next')}
              onDragLeave={onNavDragLeave}
            >
              <FiChevronRight />
            </button>
          </div>
          <div className="cal-nav-right">
            <span className="cal-post-count">{t('calendar.postsThisMonth', { count: posts.length })}</span>
            <div className="cal-view-toggle">
              {['month','week','day'].map(v => (
                <button key={v} className={`cal-view-btn${calView === v ? ' cal-view-btn--active' : ''}`}
                  onClick={() => setCalView(v)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button className="cal-today-btn" onClick={goToday}>{t('calendar.today')}</button>
          </div>
        </div>

        {calView === 'month' && (
          <>
            <div className="cal-grid-header">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="cal-dow">{d}</div>
              ))}
            </div>
            <div className={`cal-grid-wrap${loading ? ' cal-grid-wrap--loading' : ''}`}>
              <div className={`cal-grid${dragging ? ' cal-grid--dragging' : ''}`}>
                {cells.map((day, idx) => {
                  const col = idx % 7;
                  if (day === null) return <div key={`blank-${idx}`} className="cal-cell cal-cell--empty" data-col={col} />;
                  const key = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dayPosts = postsByDay[key] || [];
                  const isToday   = key === todayKey;
                  const isPast    = key < todayKey;
                  const isOver    = dragOver === key;
                  const isBlocked = dragging && isPast;
                  return (
                    <div key={key} id={isToday ? 'cal-today-cell' : undefined} data-col={col}
                      className={['cal-cell', isToday ? 'cal-cell--today' : '', isOver ? 'cal-cell--drag-over' : '', isBlocked ? 'cal-cell--blocked' : ''].filter(Boolean).join(' ')}
                      onClick={() => !dragging && setScheduleDrawer(key)}
                      onDragOver={e => onDragOver(e, key)} onDragLeave={onDragLeave} onDrop={e => onDrop(e, key)}
                    >
                      {isToday && flashKey > 0 && <div key={flashKey} className="cal-today-flash-overlay" />}
                      <div className={`cal-day-num${isToday ? ' cal-day-num--today' : ''}`}>{day}</div>
                      <div className="cal-posts">
                        {dayPosts.map((post) => {
                          const p = PLATFORM_META[post.platform] || { icon: '📄' };
                          const isDraggingThis = dragging?.id === post.id;
                          return (
                            <button key={post.id} draggable={!isPast}
                              className={['cal-post-chip', `cal-chip--${post.platform}`, isPast ? 'cal-chip--past' : '', isDraggingThis ? 'cal-chip--dragging' : ''].filter(Boolean).join(' ')}
                              onDragStart={isPast ? undefined : e => { e.stopPropagation(); onDragStart(e, post); }}
                              onDragEnd={isPast ? undefined : onDragEnd}
                              onClick={e => { e.stopPropagation(); setSelectedPost(post); }}
                              title={post.caption}
                            >
                              <span className="cal-chip-icon">{p.icon}</span>
                              <span className="cal-chip-time">{formatTime(post.scheduled_time, locale)}</span>
                              {!activeClientId && post.client_username && (
                                <span className="cal-chip-client" title={[post.client_first_name, post.client_last_name].filter(Boolean).join(' ') || post.client_username}>
                                  {(post.client_first_name || post.client_username || '').charAt(0).toUpperCase()}
                                </span>
                              )}
                              {!isPast && <FiMove className="cal-chip-grip" />}
                            </button>
                          );
                        })}
                      </div>
                      <span className="cal-cell-add-hint">+</span>
                    </div>
                  );
                })}
              </div>
              {loading && <div className="cal-loading-overlay" />}
            </div>
          </>
        )}

        {calView === 'week' && (
          <div className={`cal-week-wrap${loading ? ' cal-grid-wrap--loading' : ''}`}>
            <div className="cal-week-header">
              {weekDays.map((d) => {
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const isToday = key === todayKey;
                return (
                  <div key={key} className={`cal-week-col-head${isToday ? ' cal-week-col-head--today' : ''}`}>
                    <span className="cal-week-dow">{d.toLocaleDateString(locale, { weekday: 'short' })}</span>
                    <span className={`cal-week-date-num${isToday ? ' cal-day-num--today' : ''}`}>{d.getDate()}</span>
                  </div>
                );
              })}
            </div>
            <div className="cal-week-body">
              {weekDays.map((d) => {
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const dayPosts = postsByDay[key] || [];
                const isPast = key < todayKey;
                const isToday = key === todayKey;
                return (
                  <div key={key} className={`cal-week-col${isToday ? ' cal-week-col--today' : ''}${dragging && isPast ? ' cal-cell--blocked' : ''}${dragOver === key ? ' cal-cell--drag-over' : ''}`}
                    onClick={() => !dragging && setScheduleDrawer(key)}
                    onDragOver={e => onDragOver(e, key)} onDragLeave={onDragLeave} onDrop={e => onDrop(e, key)}
                  >
                    {dayPosts.length === 0
                      ? <span className="cal-week-empty">—</span>
                      : dayPosts.map(post => {
                          const p = PLATFORM_META[post.platform] || { icon: '📄' };
                          const isDraggingThis = dragging?.id === post.id;
                          return (
                            <button key={post.id} draggable={!isPast}
                              className={['cal-post-chip cal-week-chip', `cal-chip--${post.platform}`, isPast ? 'cal-chip--past' : '', isDraggingThis ? 'cal-chip--dragging' : ''].filter(Boolean).join(' ')}
                              onDragStart={isPast ? undefined : e => { e.stopPropagation(); onDragStart(e, post); }}
                              onDragEnd={isPast ? undefined : onDragEnd}
                              onClick={e => { e.stopPropagation(); setSelectedPost(post); }}
                              title={post.caption}
                            >
                              <span className="cal-chip-icon">{p.icon}</span>
                              <span className="cal-chip-time">{formatTime(post.scheduled_time, locale)}</span>
                              {!isPast && <FiMove className="cal-chip-grip" />}
                            </button>
                          );
                        })
                    }
                  </div>
                );
              })}
            </div>
            {loading && <div className="cal-loading-overlay" />}
          </div>
        )}

        {calView === 'day' && (() => {
          const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;
          const dayPosts = postsByDay[key] || [];
          const isPast = key < todayKey;
          const isToday = key === todayKey;
          return (
            <div className={`cal-day-wrap${loading ? ' cal-grid-wrap--loading' : ''}`}>
              <div className={`cal-day-header${isToday ? ' cal-day-header--today' : ''}`}>
                {currentDate.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className={`cal-day-body${dragging && isPast ? ' cal-cell--blocked' : ''}${dragOver === key ? ' cal-cell--drag-over' : ''}`}
                onClick={() => !dragging && setScheduleDrawer(key)}
                onDragOver={e => onDragOver(e, key)} onDragLeave={onDragLeave} onDrop={e => onDrop(e, key)}
              >
                {dayPosts.length === 0
                  ? <div className="cal-day-empty">No posts scheduled. Click to add one.</div>
                  : dayPosts.map(post => {
                      const p = PLATFORM_META[post.platform] || { icon: '📄' };
                      const isDraggingThis = dragging?.id === post.id;
                      return (
                        <button key={post.id} draggable={!isPast}
                          className={['cal-day-post-row', `cal-chip--${post.platform}`, isPast ? 'cal-chip--past' : '', isDraggingThis ? 'cal-chip--dragging' : ''].filter(Boolean).join(' ')}
                          onDragStart={isPast ? undefined : e => { e.stopPropagation(); onDragStart(e, post); }}
                          onDragEnd={isPast ? undefined : onDragEnd}
                          onClick={e => { e.stopPropagation(); setSelectedPost(post); }}
                        >
                          <span className="cal-day-post-time">{formatTime(post.scheduled_time, locale)}</span>
                          <span className="cal-chip-icon">{p.icon}</span>
                          <span className="cal-day-post-caption">{post.topic || post.caption.slice(0, 60)}</span>
                          <span className={`status-badge ${STATUS_CLS[post.status] || 'badge-draft'}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                            {post.status.replace(/_/g, ' ')}
                          </span>
                          {!isPast && <FiMove className="cal-chip-grip" style={{ marginLeft: 8 }} />}
                        </button>
                      );
                    })
                }
              </div>
              {loading && <div className="cal-loading-overlay" />}
            </div>
          );
        })()}
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
          <FiMove size={13} />
          <span>{t('calendar.dragHint')}</span>
        </div>
      </div>

      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onEdit={(id) => { setSelectedPost(null); navigate(`/edit/${id}`); }}
          onReschedule={async (postId, isoTime) => {
            await postsAPI.update(postId, { scheduled_time: isoTime });
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
