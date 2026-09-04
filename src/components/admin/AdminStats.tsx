'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Ban,
  FileStack,
  Hash,
  MessageSquare,
  Phone,
  ShieldAlert,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

interface Stats {
  totals: {
    users: number;
    online: number;
    banned: number;
    newUsersWeek: number;
    chats: number;
    groups: number;
    channels: number;
    messages: number;
    messagesDay: number;
    files: number;
    storageBytes: number;
    calls: number;
    stories: number;
    openReports: number;
  };
  series: { date: string; count: number }[];
  topChats: {
    id: string;
    title: string | null;
    type: string;
    lastMessageAt: string | null;
    _count: { members: number; messages: number };
  }[];
}

/** Instance-wide numbers: cards, a 14-day sparkline and the busiest chats. */
export function AdminStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<Stats>('/api/admin/stats'),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  const { totals, series, topChats } = data;
  const peak = Math.max(1, ...series.map((point) => point.count));

  const cards = [
    { label: 'Пользователей', value: totals.users, hint: `${totals.online} в сети`, icon: Users },
    { label: 'Новых за неделю', value: totals.newUsersWeek, icon: UserPlus },
    { label: 'Заблокировано', value: totals.banned, icon: Ban },
    { label: 'Чатов', value: totals.chats, hint: `${totals.groups} групп · ${totals.channels} каналов`, icon: Hash },
    { label: 'Сообщений', value: totals.messages, hint: `${totals.messagesDay} за сутки`, icon: MessageSquare },
    { label: 'Файлов', value: totals.files, hint: formatBytes(totals.storageBytes), icon: FileStack },
    { label: 'Звонков', value: totals.calls, icon: Phone },
    { label: 'Активных историй', value: totals.stories, icon: Sparkles },
  ];

  return (
    <div className="space-y-4">
      {totals.openReports > 0 ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-500/15 p-3 text-sm text-rose-500">
          <ShieldAlert className="h-4 w-4" /> Открытых жалоб: {totals.openReports}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="glass rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{card.label}</p>
              <card.icon className="h-4 w-4 text-ink-faint" aria-hidden />
            </div>
            <p className="mt-1 text-2xl font-extrabold text-ink">{card.value.toLocaleString('ru-RU')}</p>
            {card.hint ? <p className="text-xs text-ink-faint">{card.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="glass rounded-3xl p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-extrabold text-ink">
          <Activity className="h-4 w-4" /> Сообщения за 14 дней
        </p>
        <div className="flex h-32 items-end gap-1.5">
          {series.map((point) => (
            <div key={point.date} className="group flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-ink-faint opacity-0 transition group-hover:opacity-100">
                {point.count}
              </span>
              <div
                className="w-full rounded-t-lg bg-accent-gradient transition-all"
                style={{ height: `${Math.max(2, (point.count / peak) * 100)}%` }}
                title={`${point.date}: ${point.count}`}
              />
              <span className="text-[9px] text-ink-faint">{point.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-3xl p-5">
        <p className="mb-3 text-sm font-extrabold text-ink">Самые активные чаты</p>
        <ul className="space-y-1.5">
          {topChats.map((chat) => (
            <li key={chat.id} className="flex items-center justify-between gap-3 rounded-2xl bg-glass/50 px-3 py-2">
              <span className="min-w-0 truncate text-sm text-ink">{chat.title || 'Личный диалог'}</span>
              <span className="shrink-0 font-mono text-xs text-ink-faint">
                {chat._count.messages} сообщ. · {chat._count.members} уч.
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
