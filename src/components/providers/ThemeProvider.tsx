'use client';

import { useEffect } from 'react';
import { resolveTheme, useUi } from '@/store/ui';
import { initI18n } from '@/i18n';

/**
 * Pushes UI state onto <html> as data-attributes; every colour token in
 * globals.css keys off these, so switching a theme costs one attribute write.
 * `auto` re-evaluates every 10 minutes for the time-of-day theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, accent, density, fontScale, locale } = useUi();

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => root.setAttribute('data-theme', resolveTheme(theme));
    apply();
    root.setAttribute('data-accent', accent);
    root.setAttribute('data-density', density);
    root.style.setProperty('--font-scale', String(fontScale));

    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', resolveTheme(theme) === 'light' ? '#f8fafc' : '#0f172a');

    if (theme !== 'auto') return;
    const timer = setInterval(apply, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [theme, accent, density, fontScale]);

  useEffect(() => {
    initI18n(locale);
  }, [locale]);

  return <>{children}</>;
}
