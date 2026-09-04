'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Eye, MessageSquareX, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

type Status = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

interface Brief {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  banned: boolean;
}

interface Report {
  id: string;
  reason: string;
  details: string | null;
  status: Status;
  createdAt: string;
  reporter: Brief;
  targetUser: Brief | null;
  targetMessage: {
    id: string;
    chatId: string;
    content: string;
    contentType: string;
    createdAt: string;
    sender: Brief | null;
  } | null;
}

const TABS: { value: Status | ''; label: string }[] = [
  { value: 'OPEN', label: 'Открытые' },
  { value: 'REVIEWING', label: 'В работе' },
  { value: 'RESOLVED', label: 'Решённые' },
  { value: 'REJECTED', label: 'Отклонённые' },
  { value: '', label: 'Все' },
];

const STATUS_STYLE: Record<Status, string> = {
  OPEN: 'bg-rose-500/15 text-rose-500',
  REVIEWING: 'bg-amber-500/15 text-amber-500',
  RESOLVED: 'bg-emerald-500/15 text-emerald-500',
  REJECTED: 'bg-slate-500/15 text-ink-faint',
};

/** Moderation queue with one-click resolution. */
export function AdminReports() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status | ''>('OPEN');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () =>
      api.get<{ items: Report[]; counts: Record<string, number> }>(`/api/admin/reports?status=${status}`),
  });

  const patch = useMutation({
    mutationFn: (body: { id: string; status: Status; deleteMessage?: boolean }) =>
      api.patch('/api/admin/reports', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast.success('Жалоба обновлена');
    },
    onError: (err: Error) => toast.error('Не обновилось', err.message),
  });

  return (
    <div className="space-y-3">
      <div className="glass flex flex-wrap gap-1.5 rounded-3xl p-3">
        {TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            onClick={() => setStatus(tab.value)}
            className={cn(
              'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
              status === tab.value ? 'bg-accent-gradient text-white shadow-glow' : 'bg-glass/60 text-ink-soft',
            )}
          >
            {tab.label}
            {tab.value && data?.counts[tab.value] ? (
              <span className="ms-1 opacity-70">{data.counts[tab.value]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-3xl p-10 text-center">
          <ShieldAlert className="h-8 w-8 text-ink-faint" aria-hidden />
          <p className="text-sm font-semibold text-ink">Очередь пуста</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data?.items.map((report) => (
            <li key={report.id} className="glass space-y-2 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_STYLE[report.status])}>
                  {report.status}
                </span>
                <span className="text-sm font-bold text-ink">{report.reason}</span>
                <span className="ms-auto text-xs text-ink-faint">
                  {new Date(report.createdAt).toLocaleString('ru-RU')}
                </span>
              </div>

              {report.details ? <p className="text-sm text-ink-soft">{report.details}</p> : null}

              <div className="flex flex-wrap items-center gap-4 text-xs text-ink-faint">
                <span className="flex items-center gap-1.5">
                  Автор жалобы:
                  <Avatar name={report.reporter.name} src={report.reporter.avatarUrl} userId={report.reporter.id} size="xs" />
                  <span className="font-mono">@{report.reporter.username}</span>
                </span>
                {report.targetUser ? (
                  <span className="flex items-center gap-1.5">
                    На пользователя:
                    <Avatar
                      name={report.targetUser.name}
                      src={report.targetUser.avatarUrl}
                      userId={report.targetUser.id}
                      size="xs"
                    />
                    <span className="font-mono">@{report.targetUser.username}</span>
                    {report.targetUser.banned ? <span className="text-rose-500">(забанен)</span> : null}
                  </span>
                ) : null}
              </div>

              {report.targetMessage ? (
                <blockquote className="rounded-2xl bg-glass/60 p-3 text-sm text-ink">
                  <p className="mb-1 text-xs text-ink-faint">
                    {report.targetMessage.sender ? `@${report.targetMessage.sender.username}` : 'система'} ·{' '}
                    {report.targetMessage.contentType}
                  </p>
                  {report.targetMessage.content || <em className="text-ink-faint">без текста</em>}
                </blockquote>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="glass" onClick={() => patch.mutate({ id: report.id, status: 'REVIEWING' })}>
                  <Eye className="h-3.5 w-3.5" /> В работу
                </Button>
                <Button size="sm" variant="glass" onClick={() => patch.mutate({ id: report.id, status: 'RESOLVED' })}>
                  <CheckCheck className="h-3.5 w-3.5" /> Решено
                </Button>
                <Button size="sm" variant="ghost" onClick={() => patch.mutate({ id: report.id, status: 'REJECTED' })}>
                  <XCircle className="h-3.5 w-3.5" /> Отклонить
                </Button>
                {report.targetMessage ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => patch.mutate({ id: report.id, status: 'RESOLVED', deleteMessage: true })}
                  >
                    <MessageSquareX className="h-3.5 w-3.5" /> Удалить сообщение
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
