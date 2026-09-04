'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

interface Entry {
  id: string;
  action: string;
  target: string | null;
  meta: string | null;
  createdAt: string;
  actor: { id: string; name: string; username: string; avatarUrl: string | null } | null;
}

/** Append-only trail of every privileged action. */
export function AdminAudit() {
  const [action, setAction] = useState('');
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin', 'audit', action],
    queryFn: ({ pageParam }) =>
      api.get<{ items: Entry[]; nextCursor: string | null }>(
        `/api/admin/audit?action=${encodeURIComponent(action)}${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  return (
    <div className="space-y-3">
      <div className="glass rounded-3xl p-3">
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Фильтр по действию: user., report., ratelimit., broadcast."
          icon={<ScrollText className="h-4 w-4" />}
          aria-label="Фильтр журнала"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="glass rounded-3xl p-8 text-center text-sm text-ink-faint">Записей нет.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((entry) => (
            <li key={entry.id} className="glass flex items-center gap-3 rounded-2xl px-3 py-2">
              {entry.actor ? (
                <Avatar name={entry.actor.name} src={entry.actor.avatarUrl} userId={entry.actor.id} size="xs" />
              ) : (
                <span className="h-6 w-6 rounded-full bg-glass" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  <span className="font-mono font-semibold">{entry.action}</span>
                  {entry.target ? <span className="text-ink-faint"> → {entry.target}</span> : null}
                </p>
                {entry.meta ? <p className="truncate font-mono text-[11px] text-ink-faint">{entry.meta}</p> : null}
              </div>
              <span className="shrink-0 text-xs text-ink-faint">
                {new Date(entry.createdAt).toLocaleString('ru-RU')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="glass" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
            Показать ещё
          </Button>
        </div>
      ) : null}
    </div>
  );
}
