import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { clientsAPI } from '../services/api';

const ActiveClientContext = createContext();

const CLIENTS_POLL_INTERVAL = 30000; // 30s — picks up newly-registered clients

export function ActiveClientProvider({ children }) {
  // Re-read role reactively so the provider responds after login/logout
  // without requiring a full page reload.
  const [role, setRole] = useState(() => localStorage.getItem('role'));

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'role' || e.key === 'token') {
        setRole(localStorage.getItem('role'));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isSpecialist = role === 'specialist';

  const [clients, setClients] = useState([]);
  const [activeClientId, setActiveClientIdState] = useState(() => {
    const saved = localStorage.getItem('activeClientId');
    return saved ? parseInt(saved, 10) : null;
  });

  const refreshClients = useCallback(() => {
    if (!localStorage.getItem('token')) return;
    clientsAPI.list()
      .then(res => setClients(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isSpecialist) { setClients([]); return; }
    refreshClients();
    const id = setInterval(refreshClients, CLIENTS_POLL_INTERVAL);
    return () => clearInterval(id);
  }, [isSpecialist, refreshClients]);

  const setActiveClientId = (id) => {
    setActiveClientIdState(id);
    if (id === null) {
      localStorage.removeItem('activeClientId');
    } else {
      localStorage.setItem('activeClientId', String(id));
    }
  };

  const activeClient = clients.find(c => c.id === activeClientId) || null;

  // If the saved client no longer belongs to this specialist, clear it
  useEffect(() => {
    if (!isSpecialist || clients.length === 0 || activeClientId === null) return;
    if (!clients.find(c => c.id === activeClientId)) {
      setActiveClientId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, activeClientId, isSpecialist]);

  return (
    <ActiveClientContext.Provider value={{ clients, activeClientId, activeClient, setActiveClientId, refreshClients }}>
      {children}
    </ActiveClientContext.Provider>
  );
}

export function useActiveClient() {
  const ctx = useContext(ActiveClientContext);
  if (!ctx) throw new Error('useActiveClient must be used inside <ActiveClientProvider>');
  return ctx;
}
