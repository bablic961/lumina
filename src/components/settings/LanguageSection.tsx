'use client';

import { useMutation } from '@tanstack/react-query';
import { Focus, Languages } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { initI18n } from '@/i18n';
import { RTL_LOCALES } from '@/i18n/locales';
import { useUi } from '@/store/ui';
import { Switch } from '@/components/ui/Switch';
import { SettingsCard } from './SettingsCard';

const LOCALES: { value: string; label: string; native: string }[] = [
  { value: 'ru', label: 'Русский', native: '🇷🇺' },
  { value: 'en', label: 'English', native: '🇬🇧' },
  { value: 'es', label: 'Español', native: '🇪🇸' },
  { value: 'de', label: 'Deutsch', native: '🇩🇪' },
  { value: 'fr', label: 'Français', native: '🇫🇷' },
  { value: 'zh', label: '中文', native: '🇨🇳' },
  { value: 'ja', label: '日本語', native: '🇯🇵' },
  { value: 'ko', label: '한국어', native: '🇰🇷' },
  { value: 'ar', label: 'العربية', native: '🇸🇦' },
  { value: 'he', label: 'עברית', native: '🇮🇱' },
];

/** Interface language (RTL flips automatically) plus the focus-mode toggle. */
export function LanguageSection() {
  const { locale, focusMode, set } = useUi();
  const sync = useMutation({ mutationFn: (patch: Record<string, unknown>) => api.patch('/api/users/me', patch) });

  return (
    <SettingsCard title="Язык и режим" description="Интерфейс и концентрация" icon={<Languages className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LOCALES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={locale === item.value}
            onClick={() => {
              set('locale', item.value);
              initI18n(item.value);
              sync.mutate({ locale: item.value });
            }}
            className={cn(
              'flex items-center gap-2 rounded-2xl px-3 py-2 text-sm transition',
              locale === item.value
                ? 'bg-accent-gradient text-white shadow-glow'
                : 'bg-glass/50 text-ink hover:shadow-glow',
            )}
          >
            <span aria-hidden>{item.native}</span>
            <span className="truncate">{item.label}</span>
            {RTL_LOCALES.has(item.value) ? <span className="ms-auto text-[10px] opacity-70">RTL</span> : null}
          </button>
        ))}
      </div>

      <Switch
        checked={focusMode}
        onChange={(value) => set('focusMode', value)}
        label="Режим концентрации"
        description="Прячет счётчики и звуки, оставляя только текущий чат"
      />
      <p className="flex items-center gap-1.5 text-xs text-ink-faint">
        <Focus className="h-3.5 w-3.5" /> Быстрое переключение — в меню статуса на боковой панели.
      </p>
    </SettingsCard>
  );
}
