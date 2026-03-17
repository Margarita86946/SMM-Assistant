import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const VALID_LANGUAGES = ['EN', 'RU', 'AM'];
const VALID_THEMES = ['light', 'dark'];

export const LOCALE_MAP = { EN: 'en-US', RU: 'ru-RU', AM: 'hy-AM' };

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
