import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE } from '../constants/languages';

import en from './locales/en';
import te from './locales/te';
import hi from './locales/hi';
import kn from './locales/kn';

export const resources = {
  en: { translation: en },
  te: { translation: te },
  hi: { translation: hi },
  kn: { translation: kn },
};

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;
