'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface Rule {
  key: string;
  label: string;
  limit: number;
  windowSec: number;
  configured: boolean;
  updatedAt: string | null;
}

const WINDOWS = [
  { value: 10, label: '10 сек' },
  { value: 60, label: 'минута' },
  { value: 3600, label: 'час' },
  { value: 86400, label: 'сутки' },
  { value: 604800, label: 'неделя' },
];

/** Editable throttles; unsaved rows fall back to the code defaults. */
export function AdminRateLimits() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, { limit: number; windowSec: number }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'rate-limits'],
    queryFn: () => api.get<{ rules: Rule[] }>('/api/admin/rate-limits'),
  });

  useEffect(() => {
    if (!data) return;
    setDraft(Object.fromEntries(data.rules.map((rule) => [rule.key, { limit: rule.limit, windowSec: rule.windowSec }])));
  }, [data]);

  const save = useMutation({
    mutationFn: (body: { key: string; limit: number; windowSec: number }) => api.patch('/api/admin/rate-limits', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rate-limits'] });
      toast.success('Лимит сохранён');
    },
    onError: (err: Error) => toast.error('Не сохранилось', err.message),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs text-ink-faint">
        <Gauge className="h-4 w-4" /> Значения применяются на следующем запросе — перезапуск не нужен.
      </p>
      {data.rules.map((rule) => {
        const value = draft[rule.key] ?? { limit: rule.limit, windowSec: rule.windowSec };
        const dirty = value.limit !== rule.limit || value.windowSec !== rule.windowSec;
        return (
          <div key={rule.key} className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
            <div className="min-w-[10rem] flex-1">
              <p className="text-sm font-bold text-ink">{rule.label}</p>
              <p className="font-mono text-xs text-ink-faint">
                {rule.key}
                {rule.configured ? '' : ' · по умолчанию'}
              </p>
            </div>
            <label className="text-xs text-ink-faint">
              Запросов
              <input
                type="number"
                min={1}
                max={100000}
                value={value.limit}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [rule.key]: { ...value, limit: Number(e.target.value) } }))
                }
                className="mt-1 block h-10 w-24 rounded-2xl border border-hairline bg-glass/70 px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent-from/25"
              />
            </label>
            <label className="text-xs text-ink-faint">
              За период
              <select
                value={value.windowSec}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, [rule.key]: { ...value, windowSec: Number(e.target.value) } }))
                }
                className="mt-1 block h-10 rounded-2xl border border-hairline bg-glass/70 px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent-from/25"
              >
                {WINDOWS.map((window) => (
                  <option key={window.value} value={window.value}>
                    {window.label}
                  </option>
                ))}
                {WINDOWS.every((window) => window.value !== value.windowSec) ? (
                  <option value={value.windowSec}>{value.windowSec} сек</option>
                ) : null}
              </select>
            </label>
            <Button
              size="sm"
              disabled={!dirty}
              loading={save.isPending}
              onClick={() => save.mutate({ key: rule.key, limit: value.limit, windowSec: value.windowSec })}
            >
              <Save className="h-3.5 w-3.5" /> Сохранить
            </Button>
          </div>
        );
      })}
    </div>
  );
}
