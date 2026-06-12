import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { notificationsAPI, profileAPI } from '../services/api';

const SSE_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '');

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [shaking, setShaking] = useState(false);
  const prevUnreadRef = useRef(null);
  const audioRef = useRef(null);
  const esRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    profileAPI.get().then(res => {
      if (res.data.notifications_sound !== undefined) {
        const val = res.data.notifications_sound;
        setSoundEnabled(val);
        localStorage.setItem('notifications_sound', String(val));
      }
      if (res.data.role) {
        const serverRole = res.data.role;
        const localRole = localStorage.getItem('role');
        if (localRole !== serverRole) {
          localStorage.setItem('role', serverRole);
          window.dispatchEvent(new StorageEvent('storage', { key: 'role', newValue: serverRole }));
        }
      }
    }).catch(() => {
      const stored = localStorage.getItem('notifications_sound');
      if (stored !== null) setSoundEnabled(stored !== 'false');
    });
  }, [token]);

  const playDing = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/ding.wav');
        audioRef.current.volume = 0.4;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (_) {}
  }, [soundEnabled]);

  const fetchInitial = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await notificationsAPI.list();
      const { unread_count, notifications: list } = res.data;
      setNotifications(list);
      setUnreadCount(unread_count);
      prevUnreadRef.current = unread_count;
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!token) return;

    fetchInitial();

    let retryDelay = 5000;
    let retryCount = 0;
    const MAX_RETRIES = 10;
    let retryTimer = null;

    const connectSSE = () => {
      if (esRef.current) esRef.current.close();

      const url = `${SSE_BASE}/api/notifications/stream/?token=${token}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (e) => {
        retryDelay = 5000;
        retryCount = 0;
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'connected') return;

          const newNotification = {
            id: data.id,
            type: data.type,
            is_read: data.is_read,
            created_at: data.created_at,
            post_id: data.post_id,
            actor_name: data.actor_name,
          };

          setNotifications(prev => [newNotification, ...prev.slice(0, 19)]);
          setUnreadCount(data.unread_count);

          if (prevUnreadRef.current !== null && data.unread_count > prevUnreadRef.current) {
            playDing();
            setShaking(true);
            setTimeout(() => setShaking(false), 600);
          }
          prevUnreadRef.current = data.unread_count;
        } catch (_) {}
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (retryCount >= MAX_RETRIES) return;
        retryCount += 1;
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 60000);
          connectSSE();
        }, retryDelay);
      };
    };

    connectSSE();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [token, fetchInitial, playDing]);

  const markRead = useCallback(async (id) => {
    await notificationsAPI.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    prevUnreadRef.current = Math.max(0, (prevUnreadRef.current ?? 1) - 1);
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationsAPI.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    prevUnreadRef.current = 0;
  }, []);

  const updateSoundEnabled = useCallback((val) => {
    setSoundEnabled(val);
    localStorage.setItem('notifications_sound', String(val));
    profileAPI.update({ notifications_sound: val }).catch(() => {});
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await notificationsAPI.list();
      const { unread_count, notifications: list } = res.data;
      setNotifications(list);
      setUnreadCount(unread_count);
      prevUnreadRef.current = unread_count;
    } catch (_) {}
  }, []);

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      soundEnabled,
      shaking,
      updateSoundEnabled,
      markRead,
      markAllRead,
      refetch,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
