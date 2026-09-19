import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  isValidLanguageCode,
} from '../constants/languages';

const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: async () => {},
  isReady: false,
  languages: SUPPORTED_LANGUAGES,
  t: (key, options) => key,
});

export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(DEFAULT_LANGUAGE);
  const [isReady, setIsReady] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    let mounted = true;

    async function loadSavedLanguage() {
      let activeLng = DEFAULT_LANGUAGE;
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (isValidLanguageCode(stored)) {
          activeLng = stored;
        }
      } catch (err) {
        console.warn('[LanguageContext] Failed to read saved language from AsyncStorage:', err);
      }

      if (i18n.language !== activeLng) {
        await i18n.changeLanguage(activeLng);
      }

      if (mounted) {
        setCurrentLanguage(activeLng);
        setIsReady(true);
      }
    }

    loadSavedLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  const changeLanguage = useCallback(async (code) => {
    if (!isValidLanguageCode(code)) return;
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      await i18n.changeLanguage(code);
      setCurrentLanguage(code);
    } catch (err) {
      console.warn('[LanguageContext] Failed to persist language:', err);
    }
  }, []);

  const value = useMemo(
    () => ({
      language: currentLanguage,
      languageLabel: (SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || {}).label || 'English',
      setLanguage: changeLanguage,
      isReady,
      languages: SUPPORTED_LANGUAGES,
      t,
    }),
    [currentLanguage, changeLanguage, isReady, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
