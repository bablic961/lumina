'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { useChatStore } from '@/store/chat';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { useMessages } from '@/hooks/useMessages';
import { useRealtimeFallback } from '@/hooks/useRealtimeFallback';
import { useMe } from '@/components/providers/MeProvider';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { PinnedBar } from '@/components/chat/PinnedBar';
import { MessageList } from '@/components/chat/MessageList';
import { Composer } from '@/components/chat/Composer';
import { MessagesSkeleton } from '@/components/ui/Skeleton';
import type { ChatDetailResponse } from '@/types';

export function ChatView({ chatId }: { chatId: string }) {
  const { me } = useMe();
  const { socket } = useSocketContext();
  const focusMode = useUi((s) => s.focusMode);
  const patchChat = useChatStore((s) => s.patchChat);
  // `?message=<id>` deep links (search, saved, notifications) open that window.
  const target = useSearchParams().get('message');
  const { messages, hasMore, loading, loadingMore, loadOlder } = useMessages(chatId, target);
  // Polls for new messages whenever the websocket is unavailable.
  useRealtimeFallback(chatId);

  const detail = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => api.get<ChatDetailResponse>(`/api/chats/${chatId}`),
  });
  const chat = detail.data?.chat;
  const myRole = detail.data?.me.role;

  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', { chatId });
    return () => {
      socket.emit('chat:leave', { chatId });
    };
  }, [socket, chatId]);

  // Opening a chat clears its badge locally; the server confirms on message:read.
  useEffect(() => {
    patchChat(chatId, { unreadCount: 0 });
  }, [chatId, patchChat]);

  // Highlight the deep-linked message once its window has rendered.
  useEffect(() => {
    if (!target || loading) return;
    const node = document.getElementById(`msg-${target}`);
    if (!node) return;
    node.scrollIntoView({ block: 'center' });
    node.classList.add('ring-2', 'ring-accent-from', 'rounded-2xl');
    const timer = setTimeout(() => node.classList.remove('ring-2', 'ring-accent-from', 'rounded-2xl'), 1800);
    return () => clearTimeout(timer);
  }, [target, loading, messages.length]);

  return (
    <div
      className="relative flex h-full flex-col"
      style={
        // Wallpapers are stored either as a CSS gradient (the built-in presets)
        // or as an uploaded image URL — both go through backgroundImage, but
        // only the latter needs url().
        chat?.wallpaper
          ? {
              backgroundImage: /^(linear|radial|conic)-gradient\(/.test(chat.wallpaper)
                ? chat.wallpaper
                : `url(${chat.wallpaper})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {chat?.wallpaper ? <div className="absolute inset-0 bg-canvas/55 backdrop-blur-sm" aria-hidden /> : null}

      <div className={cn('relative flex min-h-0 flex-1 flex-col', focusMode && 'mx-auto w-full max-w-3xl')}>
        <ChatHeader chat={chat} chatId={chatId} loading={detail.isLoading} />
        <PinnedBar chatId={chatId} messages={messages} />

        {loading ? (
          <div className="min-h-0 flex-1 overflow-hidden px-4">
            <MessagesSkeleton />
          </div>
        ) : (
          <MessageList
            chatId={chatId}
            chat={chat}
            messages={messages}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadOlder={loadOlder}
            me={me}
          />
        )}

        <Composer chatId={chatId} chat={chat} myRole={myRole} draft={detail.data?.me.draft ?? null} />
      </div>
    </div>
  );
}
