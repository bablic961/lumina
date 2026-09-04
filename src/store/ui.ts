'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Accent, Density, ThemeName } from '@/types';

interface UiState {
  theme: ThemeName;
  accent: Accent;
  density: Density;
  fontScale: number;
  locale: string;
  focusMode: boolean;
  soundEnabled: boolean;
  soundTone: 'chime' | 'drop' | 'pulse';
  sidebarOpen: boolean;
  rightPanel: 'none' | 'info' | 'media' | 'members' | 'search';
  commandOpen: boolean;
  lightbox: { urls: string[]; index: number } | null;
  set: <K extends keyof UiState>(key: K, value: UiState[K]) => void;
  toggleFocus: () => void;
  openLightbox: (urls: string[], index: number) => void;
  closeLightbox: () => void;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      accent: 'amber',
      density: 'cozy',
      fontScale: 1,
      locale: 'ru',
      focusMode: false,
      soundEnabled: true,
      soundTone: 'chime',
      sidebarOpen: true,
      rightPanel: 'none',
      commandOpen: false,
      lightbox: null,
      set: (key, value) => set({ [key]: value } as Partial<UiState>),
      toggleFocus: () => set({ focusMode: !get().focusMode }),
      openLightbox: (urls, index) => set({ lightbox: { urls, index } }),
      closeLightbox: () => set({ lightbox: null }),
    }),
    {
      name: 'lumina.ui',
      partialize: ({ theme, accent, density, fontScale, locale, soundEnabled, soundTone, focusMode }) => ({
        theme,
        accent,
        density,
        fontScale,
        locale,
        soundEnabled,
        soundTone,
        focusMode,
      }),
    },
  ),
);

/** Resolves `auto` (theme by time of day) into a concrete theme. */
export function resolveTheme(theme: ThemeName): Exclude<ThemeName, 'auto'> {
  if (theme !== 'auto') return theme;
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19 ? 'light' : 'dark';
}
