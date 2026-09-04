'use client';

import { useMutation } from '@tanstack/react-query';
import { Monitor, Moon, Palette, Sun, SunMoon } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { Segmented } from '@/components/ui/Switch';
import { SettingsCard, Row } from './SettingsCard';
import { ACCENTS, type Accent, type Density, type ThemeName } from '@/types';

const THEMES: { value: ThemeName; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Светлая', icon: <Sun className="h-3.5 w-3.5" /> },
  { value: 'dark', label: 'Тёмная', icon: <Moon className="h-3.5 w-3.5" /> },
  { value: 'amoled', label: 'AMOLED', icon: <Monitor className="h-3.5 w-3.5" /> },
  { value: 'auto', label: 'По времени', icon: <SunMoon className="h-3.5 w-3.5" /> },
];

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Плотно' },
  { value: 'cozy', label: 'Уютно' },
  { value: 'roomy', label: 'Свободно' },
];

/** CSS gradient per accent, mirroring the `[data-accent]` rules in globals.css. */
const SWATCH: Record<Accent, string> = {
  amber: 'linear-gradient(135deg, #f59e0b, #ec4899)',
  rose: 'linear-gradient(135deg, #f43f5e, #fb923c)',
  teal: 'linear-gradient(135deg, #14b8a6, #3b82f6)',
  violet: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
  lime: 'linear-gradient(135deg, #84cc16, #10b981)',
  sky: 'linear-gradient(135deg, #38bdf8, #818cf8)',
  fuchsia: 'linear-gradient(135deg, #d946ef, #6366f1)',
  emerald: 'linear-gradient(135deg, #10b981, #84cc16)',
  orange: 'linear-gradient(135deg, #f97316, #ef4444)',
  indigo: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
  pink: 'linear-gradient(135deg, #ec4899, #a855f7)',
  gold: 'linear-gradient(135deg, #eab308, #f59e0b)',
};

const NAMES: Record<Accent, string> = {
  amber: 'Янтарь',
  rose: 'Роза',
  teal: 'Бирюза',
  violet: 'Фиалка',
  lime: 'Лайм',
  sky: 'Небо',
  fuchsia: 'Фуксия',
  emerald: 'Изумруд',
  orange: 'Апельсин',
  indigo: 'Индиго',
  pink: 'Пион',
  gold: 'Золото',
};

/**
 * Theme, accent, density and font scale. Changes apply instantly through the
 * UI store (ThemeProvider writes them onto `<html>`) and are mirrored to the
 * account so a new device inherits the same look.
 */
export function AppearanceSection() {
  const { theme, accent, density, fontScale, set } = useUi();
  const sync = useMutation({ mutationFn: (patch: Record<string, unknown>) => api.patch('/api/users/me', patch) });

  return (
    <SettingsCard title="Оформление" description="Тема, акцент и плотность" icon={<Palette className="h-4 w-4" />}>
      <Row label="Тема">
        <Segmented
          value={theme}
          onChange={(value) => {
            set('theme', value);
            sync.mutate({ theme: value });
          }}
          options={THEMES}
        />
      </Row>

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Акцент</p>
        <div className="grid grid-cols-6 gap-2">
          {ACCENTS.map((value) => (
            <button
              key={value}
              type="button"
              title={NAMES[value]}
              aria-label={NAMES[value]}
              aria-pressed={accent === value}
              onClick={() => {
                set('accent', value);
                sync.mutate({ accent: value });
              }}
              className={cn(
                'h-10 rounded-2xl transition hover:scale-105',
                accent === value && 'ring-2 ring-offset-2 ring-offset-transparent ring-ink/40',
              )}
              style={{ backgroundImage: SWATCH[value] }}
            />
          ))}
        </div>
      </div>

      <Row label="Плотность" hint="Отступы в списке чатов и сообщениях">
        <Segmented
          value={density}
          onChange={(value) => {
            set('density', value);
            sync.mutate({ density: value });
          }}
          options={DENSITIES}
        />
      </Row>

      <Row label={`Размер шрифта · ${Math.round(fontScale * 100)}%`} hint="От 80% до 140%">
        <input
          type="range"
          min={0.8}
          max={1.4}
          step={0.05}
          value={fontScale}
          onChange={(e) => set('fontScale', Number(e.target.value))}
          onPointerUp={() => sync.mutate({ fontScale })}
          className="h-2 w-44 cursor-pointer appearance-none rounded-full bg-glass accent-accent-from"
          aria-label="Размер шрифта"
        />
      </Row>

      <p className="text-xs text-ink-faint">
        Обои задаются отдельно для каждого чата — в панели информации о чате.
      </p>
    </SettingsCard>
  );
}
