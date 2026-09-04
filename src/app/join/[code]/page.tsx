'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Hash, LogIn, Megaphone, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface Preview {
  chat: {
    id: string;
    type: 'GROUP' | 'CHANNEL' | 'DM';
    title: string | null;
    description: string | null;
    avatarUrl: string | null;
    _count: { members: number };
  };
  alreadyMember: boolean;
}

/** Invite landing page: preview the chat, then join with one tap. */
export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['invite', code],
    queryFn: () => api.get<Preview>(`/api/invites/${encodeURIComponent(code)}`),
    retry: false,
  });

  const join = useMutation({
    mutationFn: () => api.post<{ chatId: string; joined: boolean }>(`/api/invites/${encodeURIComponent(code)}`, {}),
    onSuccess: ({ chatId, joined }) => {
      toast.success(joined ? 'Вы присоединились' : 'Вы уже участник');
      router.push(`/app/chat/${chatId}`);
    },
    onError: (err: Error) => toast.error('Не удалось войти', err.message),
  });

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <div className="glass w-full max-w-md space-y-4 rounded-3xl p-7 text-center">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="mx-auto h-16 w-16 rounded-full" />
            <Skeleton className="mx-auto h-4 w-40" />
            <Skeleton className="mx-auto h-3 w-56" />
            <Skeleton className="h-10 w-full rounded-2xl" />
          </div>
        ) : error || !data ? (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-rose-500/15 text-rose-500">
              <LogIn className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="text-lg font-extrabold text-ink">Ссылка не работает</h1>
            <p className="text-sm text-ink-faint">
              {(error as Error | null)?.message ?? 'Приглашение истекло, исчерпано или было отозвано.'}
            </p>
            <Link href="/app">
              <Button variant="glass" className="w-full">
                В приложение
              </Button>
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto">
              <Avatar name={data.chat.title || 'Чат'} src={data.chat.avatarUrl} size="xl" ring />
            </div>
            <div>
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {data.chat.type === 'CHANNEL' ? (
                  <>
                    <Megaphone className="h-3.5 w-3.5" /> Канал
                  </>
                ) : (
                  <>
                    <Hash className="h-3.5 w-3.5" /> Группа
                  </>
                )}
              </p>
              <h1 className="mt-1 text-xl font-extrabold text-ink">{data.chat.title || 'Без названия'}</h1>
              <p className="flex items-center justify-center gap-1.5 text-xs text-ink-faint">
                <Users className="h-3.5 w-3.5" /> {data.chat._count.members} участников
              </p>
            </div>
            {data.chat.description ? (
              <p className="whitespace-pre-wrap text-sm text-ink-soft">{data.chat.description}</p>
            ) : null}
            <Button onClick={() => join.mutate()} loading={join.isPending} className="w-full">
              {data.alreadyMember ? 'Открыть чат' : 'Присоединиться'}
            </Button>
            <p className="text-[11px] text-ink-faint">
              Присоединяясь, вы соглашаетесь с правилами сообщества. Выйти можно в любой момент.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
