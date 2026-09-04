'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bookmark, BookmarkX, ExternalLink, Hash, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { RichText } from '@/components/chat/RichText';
import { MessageAttachments } from '@/components/chat/MessageAttachments';
import type { ChatType, ContentType, MessageDTO } from '@/types';

interface SavedItem {
  id: string;
  savedAt: string;
  message: MessageDTO & { chat: { id: string; title: string | null; type: ChatType; avatarUrl: string | null } };
}

const PREVIEW: Partial<Record<ContentType, string>> = {
  VOICE: '🎙 Голосовое сообщение',
  STICKER: '🌟 Стикер',
  POLL: '📊 Опрос',
  CALL: '📞 Звонок',
  LOCATION: '📍 Геопозиция',
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** Bookmarks across every chat — the personal "read it later" shelf. */
export default function SavedPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['saved'],
    queryFn: ({ pageParam }) => api.get<{ items: SavedItem[]; nextCursor: string | null }>(`/api/saved${pageParam ? `?cursor=${pageParam}` : ''}`),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);

  const remove = useMutation({
    mutationFn: (messageId: string) => api.del(`/api/messages/${messageId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved'] });
      toast.success('Убрано из сохранённых');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="h-full overflow-y-auto">
      <header className="glass-strong sticky top-0 z-10 flex items-center gap-3 border-b border-hairline px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow">
          <Bookmark className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold text-ink">Сохранённые сообщения</h1>
          <p className="text-xs text-ink-faint">
            {isLoading ? 'Загрузка…' : `${items.length}${hasNextPage ? '+' : ''} закладок`}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-3 p-5 pb-24 md:pb-5">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="glass space-y-3 rounded-3xl p-4">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-3xl p-12 text-center">
            <Bookmark className="h-10 w-10 text-ink-faint" aria-hidden />
            <p className="text-sm font-semibold text-ink">Здесь пока пусто</p>
            <p className="max-w-xs text-xs text-ink-faint">
              Долгое нажатие или меню сообщения → «Сохранить», и оно появится в этом списке.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const { message } = item;
            const chatTitle = message.chat.title || message.sender?.name || 'Диалог';
            return (
              <article key={item.id} className="glass hover-glow rounded-3xl p-4">
                <div className="flex items-center gap-2.5">
                  {message.chat.type === 'CHANNEL' ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-glass/70 text-ink-soft">
                      <Hash className="h-4 w-4" aria-hidden />
                    </span>
                  ) : message.chat.type === 'GROUP' ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-glass/70 text-ink-soft">
                      <Users className="h-4 w-4" aria-hidden />
                    </span>
                  ) : (
                    <Avatar name={chatTitle} src={message.chat.avatarUrl} size="xs" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{chatTitle}</p>
                    <p className="text-[11px] text-ink-faint">
                      {message.sender?.name ?? 'Система'} · {formatDate(message.createdAt)}
                    </p>
                  </div>
                  <Link
                    href={`/app/chat/${message.chatId}?message=${message.id}`}
                    className="press flex h-9 w-9 items-center justify-center rounded-xl text-ink-faint hover:bg-glass/70 hover:text-ink"
                    aria-label="Открыть в чате"
                    title="Открыть в чате"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </Link>
                  <button
                    onClick={() => remove.mutate(message.id)}
                    className="press flex h-9 w-9 items-center justify-center rounded-xl text-ink-faint hover:bg-glass/70 hover:text-rose-500"
                    aria-label="Убрать из сохранённых"
                    title="Убрать из сохранённых"
                  >
                    <BookmarkX className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                <div className="mt-3 text-sm text-ink">
                  {PREVIEW[message.contentType] ? (
                    <p className="text-ink-soft">{PREVIEW[message.contentType]}</p>
                  ) : message.content ? (
                    <RichText text={message.content} outgoing={false} />
                  ) : null}
                  {message.attachments.length > 0 ? (
                    <div className="mt-2">
                      <MessageAttachments attachments={message.attachments} outgoing={false} />
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}

        {hasNextPage ? (
          <Button variant="glass" className="w-full" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            Показать ещё
          </Button>
        ) : null}
      </div>
    </div>
  );
}
