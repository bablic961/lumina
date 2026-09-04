'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Cake, Flag, Hash, MessageSquare, Sparkles, Undo2, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { BADGE_LABELS } from '@/lib/badges';
import { toast } from '@/store/toast';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Presence } from '@/types';

interface Profile {
  user: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    verified: boolean;
    presence: Presence;
    statusEmoji: string | null;
    statusText: string | null;
    lastSeenAt: string | null;
    birthday: string | null;
    createdAt: string;
    badges: { id: string; key: string; earnedAt: string }[];
    _count: { messages: number };
  };
  mine: boolean;
  blocked: boolean;
  sharedChats: { id: string; title: string | null; type: string; avatarUrl: string | null; _count: { members: number } }[];
  dmChatId: string | null;
  activeStories: number;
  canMessage: boolean;
}

const PRESENCE_LABEL: Record<Presence, string> = {
  ONLINE: 'в сети',
  AWAY: 'отошёл',
  DND: 'не беспокоить',
  OFFLINE: 'не в сети',
};

/** Public profile: `/app/u/<username>`. */
export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get<Profile>(`/api/users/${encodeURIComponent(username)}`),
    retry: false,
  });

  const openDm = useMutation({
    mutationFn: () =>
      api.post<{ chatId: string }>('/api/chats', { type: 'DM', memberIds: [data?.user.id], e2eEnabled: false }),
    onSuccess: ({ chatId }) => router.push(`/app/chat/${chatId}`),
    onError: (err: Error) => toast.error('Диалог не открылся', err.message),
  });

  const block = useMutation({
    mutationFn: (next: boolean) =>
      next ? api.post('/api/users/block', { userId: data?.user.id }) : api.del(`/api/users/block?userId=${data?.user.id}`),
    onSuccess: (_res, next) => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      toast.success(next ? 'Пользователь заблокирован' : 'Разблокирован');
    },
  });

  const report = useMutation({
    mutationFn: (reason: string) => api.post('/api/reports', { targetUserId: data?.user.id, reason }),
    onSuccess: () => toast.success('Жалоба отправлена', 'Модераторы посмотрят'),
    onError: (err: Error) => toast.error('Не отправилось', err.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="glass max-w-sm space-y-2 rounded-3xl p-8 text-center">
          <UserRound className="mx-auto h-10 w-10 text-ink-faint" aria-hidden />
          <p className="text-sm font-semibold text-ink">Профиль не найден</p>
          <p className="text-xs text-ink-faint">Возможно, пользователь сменил @username или закрыл профиль.</p>
        </div>
      </div>
    );
  }

  const { user } = data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-5 pb-24 md:pb-8">
        <div className="glass relative overflow-hidden rounded-3xl p-6">
          <div className="pointer-events-none absolute -end-16 -top-16 h-48 w-48 rounded-full bg-accent-gradient opacity-20 blur-3xl" />
          <div className="relative flex flex-wrap items-center gap-4">
            <Avatar
              name={user.name}
              src={user.avatarUrl}
              userId={user.id}
              size="xl"
              presence={user.presence}
              verified={user.verified}
              ring={data.activeStories > 0}
            />
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 truncate text-xl font-extrabold text-ink">
                {user.name}
                {user.statusEmoji ? <span aria-hidden>{user.statusEmoji}</span> : null}
              </h1>
              <p className="font-mono text-sm text-ink-faint">@{user.username}</p>
              <p className="text-xs text-ink-faint">
                {PRESENCE_LABEL[user.presence]}
                {user.lastSeenAt && user.presence === 'OFFLINE'
                  ? ` · был(а) ${new Date(user.lastSeenAt).toLocaleString('ru-RU')}`
                  : ''}
              </p>
              {user.statusText ? <p className="mt-1 text-sm text-ink-soft">{user.statusText}</p> : null}
            </div>
          </div>

          {user.bio ? <p className="relative mt-4 whitespace-pre-wrap text-sm text-ink">{user.bio}</p> : null}

          <div className="relative mt-4 flex flex-wrap gap-2">
            {!data.mine ? (
              <>
                {data.dmChatId ? (
                  <Link href={`/app/chat/${data.dmChatId}`}>
                    <Button>
                      <MessageSquare className="h-4 w-4" /> Открыть диалог
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => openDm.mutate()}
                    loading={openDm.isPending}
                    disabled={!data.canMessage || data.blocked}
                  >
                    <MessageSquare className="h-4 w-4" /> Написать
                  </Button>
                )}
                <Button variant={data.blocked ? 'glass' : 'ghost'} onClick={() => block.mutate(!data.blocked)}>
                  {data.blocked ? <Undo2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                  {data.blocked ? 'Разблокировать' : 'Заблокировать'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const reason = window.prompt('Причина жалобы?', 'Спам');
                    if (reason?.trim()) report.mutate(reason.trim());
                  }}
                >
                  <Flag className="h-4 w-4" /> Пожаловаться
                </Button>
              </>
            ) : (
              <Link href="/app/settings">
                <Button variant="glass">Редактировать профиль</Button>
              </Link>
            )}
          </div>

          {!data.canMessage && !data.mine ? (
            <p className="relative mt-2 text-xs text-amber-500">
              Пользователь ограничил, кто может писать ему первым.
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="glass rounded-3xl p-4 text-center">
            <p className="text-2xl font-extrabold text-ink">{user._count.messages.toLocaleString('ru-RU')}</p>
            <p className="text-xs text-ink-faint">сообщений</p>
          </div>
          <div className="glass rounded-3xl p-4 text-center">
            <p className="text-2xl font-extrabold text-ink">{data.activeStories}</p>
            <p className="text-xs text-ink-faint">активных историй</p>
          </div>
          <div className="glass rounded-3xl p-4 text-center">
            <p className="text-2xl font-extrabold text-ink">
              {new Date(user.createdAt).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })}
            </p>
            <p className="text-xs text-ink-faint">с нами с</p>
          </div>
        </div>

        {user.badges.length ? (
          <div className="glass rounded-3xl p-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
              <Sparkles className="h-4 w-4" /> Награды
            </p>
            <div className="flex flex-wrap gap-1.5">
              {user.badges.map((badge) => (
                <span
                  key={badge.id}
                  title={new Date(badge.earnedAt).toLocaleDateString('ru-RU')}
                  className="rounded-full bg-glass px-3 py-1 text-xs text-ink"
                >
                  {BADGE_LABELS[badge.key] ?? badge.key}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {user.birthday ? (
          <p className="flex items-center gap-2 px-2 text-xs text-ink-faint">
            <Cake className="h-4 w-4" /> День рождения: {user.birthday.split('-').reverse().join('.')}
          </p>
        ) : null}

        {data.sharedChats.length ? (
          <div className="glass rounded-3xl p-5">
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
              <Hash className="h-4 w-4" /> Общие чаты
            </p>
            <ul className="space-y-1.5">
              {data.sharedChats.map((chat) => (
                <li key={chat.id}>
                  <Link
                    href={`/app/chat/${chat.id}`}
                    className="flex items-center gap-2 rounded-2xl bg-glass/50 p-2 transition hover:shadow-glow"
                  >
                    <Avatar name={chat.title || 'Чат'} src={chat.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{chat.title || 'Без названия'}</span>
                    <span className="shrink-0 text-xs text-ink-faint">{chat._count.members} уч.</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
