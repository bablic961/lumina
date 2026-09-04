'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Ban, Search, ShieldCheck, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

interface Row {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  verified: boolean;
  banned: boolean;
  banReason: string | null;
  presence: string;
  createdAt: string;
  lastSeenAt: string;
  _count: { messages: number; memberships: number };
}

const FILTERS = [
  { value: '', label: 'Все' },
  { value: 'banned', label: 'Заблокированные' },
  { value: 'admins', label: 'Админы' },
  { value: 'verified', label: 'Верифицированные' },
];

/** Moderation table: search, ban, verify, promote. */
export function AdminUsers() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', q, filter, page],
    queryFn: () =>
      api.get<{ users: Row[]; total: number; page: number; pageSize: number }>(
        `/api/admin/users?q=${encodeURIComponent(q)}&filter=${filter}&page=${page}`,
      ),
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/api/admin/users', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Изменения применены');
    },
    onError: (err: Error) => toast.error('Не применилось', err.message),
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="glass flex flex-wrap items-center gap-2 rounded-3xl p-3">
        <div className="min-w-[12rem] flex-1">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Имя, @username или email"
            icon={<Search className="h-4 w-4" />}
            aria-label="Поиск пользователей"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setFilter(item.value);
                setPage(1);
              }}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition',
                filter === item.value ? 'bg-accent-gradient text-white shadow-glow' : 'bg-glass/60 text-ink-soft',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {data?.users.map((user) => (
            <li key={user.id} className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3">
              <Avatar name={user.name} src={user.avatarUrl} userId={user.id} size="md" verified={user.verified} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
                  {user.name}
                  {user.role === 'ADMIN' ? <ShieldCheck className="h-3.5 w-3.5 text-accent-from" /> : null}
                  {user.banned ? (
                    <span className="rounded-full bg-rose-500/15 px-2 text-[10px] font-semibold text-rose-500">
                      бан
                    </span>
                  ) : null}
                </p>
                <p className="truncate font-mono text-xs text-ink-faint">
                  @{user.username} · {user.email}
                </p>
                <p className="text-[11px] text-ink-faint">
                  {user._count.messages} сообщ. · {user._count.memberships} чатов ·{' '}
                  {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                  {user.banned && user.banReason ? ` · ${user.banReason}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="glass"
                  onClick={() => patch.mutate({ userId: user.id, verified: !user.verified })}
                >
                  <BadgeCheck className="h-3.5 w-3.5" /> {user.verified ? 'Снять' : 'Верифицировать'}
                </Button>
                <Button
                  size="sm"
                  variant="glass"
                  onClick={() => patch.mutate({ userId: user.id, role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> {user.role === 'ADMIN' ? 'Разжаловать' : 'В админы'}
                </Button>
                {user.banned ? (
                  <Button size="sm" variant="glass" onClick={() => patch.mutate({ userId: user.id, banned: false })}>
                    <Undo2 className="h-3.5 w-3.5" /> Разбанить
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      const reason = window.prompt('Причина блокировки?', 'Нарушение правил');
                      if (reason === null) return;
                      patch.mutate({ userId: user.id, banned: true, banReason: reason });
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" /> Забанить
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button variant="glass" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Назад
          </Button>
          <span className="text-xs text-ink-faint">
            {page} / {pages}
          </span>
          <Button variant="glass" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Вперёд
          </Button>
        </div>
      ) : null}
    </div>
  );
}
