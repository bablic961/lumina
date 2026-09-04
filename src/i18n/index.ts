'use client';

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources, RTL_LOCALES } from '@/i18n/locales';

let started = false;

export function initI18n(locale?: string) {
  const detected =
    locale ||
    (typeof navigator !== 'undefined' ? navigator.language.split('-')[0] : 'ru');
  const lng = detected in resources ? detected : 'en';

  if (!started) {
    i18next.use(initReactI18next).init({
      resources: resources as never,
      lng,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    started = true;
  } else if (i18next.language !== lng) {
    i18next.changeLanguage(lng);
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
    document.documentElement.dir = RTL_LOCALES.has(lng) ? 'rtl' : 'ltr';
  }
  return i18next;
}

export { i18next };
