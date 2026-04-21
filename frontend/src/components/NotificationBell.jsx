import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationsContext';
import { useTranslation } from '../i18n';
import '../styles/NotificationBell.css';

function timeAgo(isoString, t) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return t('notifications.justNow');
  if (diff < 3600) return t('notifications.minutesAgo').replace('{n}', Math.floor(diff / 60));
  if (diff < 86400) return t('notifications.hoursAgo').replace('{n}', Math.floor(diff / 3600));
  return t('notifications.daysAgo').replace('{n}', Math.floor(diff / 86400));
}

function notifLabel(n, t) {
  const name = n.actor_name || t('notifications.someone');
  switch (n.type) {
    case 'post_submitted': return t('notifications.postSubmitted').replace('{name}', name);
    case 'post_approved': return t('notifications.postApproved').replace('{name}', name);
    case 'post_rejected': return t('notifications.postRejected').replace('{name}', name);
    case 'post_published': return t('notifications.postPublished');
    case 'invitation_accepted': return t('notifications.invitationAccepted').replace('{name}', name);
    default: return n.type;
  }
}

function deepLinkFor(n) {
  if (n.post_id) return '/posts';
  return '/dashboard';
}

export function NotificationBell() {
  const { notifications, unreadCount, shaking, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (n) => {
    if (!n.is_read) await markRead(n.id);
    setOpen(false);
    navigate(deepLinkFor(n));
  };

  const handleMarkAll = async (e) => {
    e.stopPropagation();
    await markAllRead();
  };

  const recent = notifications.slice(0, 5);

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button
        className={`notif-bell-btn${open ? ' active' : ''}${shaking ? ' shaking' : ''}`}
        onClick={() => setOpen(o => !o)}
        title={t('notifications.title')}
        aria-label={t('notifications.title')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button className="notif-mark-all-btn" onClick={handleMarkAll}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <div className="notif-empty">{t('notifications.empty')}</div>
          ) : (
            <ul className="notif-list">
              {recent.map(n => (
                <li
                  key={n.id}
                  className={`notif-item${n.is_read ? '' : ' notif-item--unread'}`}
                  onClick={() => handleClick(n)}
                >
                  <div className="notif-item-dot" />
                  <div className="notif-item-body">
                    <p className="notif-item-text">{notifLabel(n, t)}</p>
                    <span className="notif-item-time">{timeAgo(n.created_at, t)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function NotificationToast() {
  const { notifications } = useNotifications();
  const [toasts, setToasts] = useState([]);
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (notifications.length === 0) return;

    // On first load, mark all existing notifications as "already seen" without toasting
    if (!initializedRef.current) {
      notifications.forEach(n => seenRef.current.add(n.id));
      initializedRef.current = true;
      return;
    }

    const newToasts = notifications.filter(n => !n.is_read && !seenRef.current.has(n.id));
    if (newToasts.length === 0) return;

    newToasts.forEach(n => seenRef.current.add(n.id));
    const entries = newToasts.map(n => ({ ...n, toastId: n.id }));

    setToasts(prev => [...prev, ...entries]);

    const timeout = setTimeout(() => {
      setToasts(prev => prev.filter(t => !entries.find(e => e.toastId === t.toastId)));
    }, 5000);
    return () => clearTimeout(timeout);
  }, [notifications]);

  if (toasts.length === 0) return null;

  return (
    <div className="notif-toast-container">
      {toasts.map(n => (
        <div key={n.toastId} className="notif-toast">
          <div className="notif-toast-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div className="notif-toast-body">
            <p className="notif-toast-title">{t('notifications.newNotification')}</p>
            <p className="notif-toast-text">{notifLabel(n, t)}</p>
          </div>
          <button
            className="notif-toast-close"
            onClick={() => setToasts(prev => prev.filter(x => x.toastId !== n.toastId))}
          >×</button>
        </div>
      ))}
    </div>
  );
}
