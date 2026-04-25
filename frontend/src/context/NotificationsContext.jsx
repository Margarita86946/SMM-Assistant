import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { notificationsAPI, profileAPI } from '../services/api';

const NotificationsContext = createContext(null);

const POLL_INTERVAL = 12000;

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [shaking, setShaking] = useState(false);
  const prevUnreadRef = useRef(null);
  const audioRef = useRef(null);
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

  const fetchNotifications = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const res = await notificationsAPI.list();
      const { unread_count, notifications: list } = res.data;
      setNotifications(list);
      setUnreadCount(unread_count);
      if (prevUnreadRef.current !== null && unread_count > prevUnreadRef.current) {
        playDing();
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
      }
      prevUnreadRef.current = unread_count;
    } catch (_) {}
  }, [playDing]);

  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [token, fetchNotifications]);

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

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      soundEnabled,
      shaking,
      updateSoundEnabled,
      markRead,
      markAllRead,
      refetch: fetchNotifications,
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
