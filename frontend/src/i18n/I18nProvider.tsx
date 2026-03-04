import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Locale, translations } from './translations';

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, fallback?: string, params?: TranslationParams) => string;
};

const LOCALE_STORAGE_KEY = 'data_lineage_locale';
type TranslationParams = Record<string, string | number | boolean | null | undefined>;

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

const getInitialLocale = (): Locale => {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') {
      return stored;
    }
  } catch {
    // ignore storage errors and fall back to browser locale
  }

  if (typeof navigator !== 'undefined') {
    const browserLocale = (navigator.language || '').toLowerCase();
    if (browserLocale.startsWith('zh')) {
      return 'zh';
    }
  }

  return 'en';
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const t = useCallback((key: string, fallback?: string, params?: TranslationParams): string => {
    const value = translations[locale]?.[key];
    const template = typeof value === 'string' ? value : fallback || key;
    if (!params) {
      return template;
    }
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}|\{([a-zA-Z0-9_]+)\}/g, (match, p1, p2) => {
      const paramKey = p1 || p2;
      const paramValue = params[paramKey];
      if (paramValue === undefined || paramValue === null) {
        return match;
      }
      return String(paramValue);
    });
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
      document.title = t('app.title', 'Data Lineage Canvas');
    }
  }, [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
