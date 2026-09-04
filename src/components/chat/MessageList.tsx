'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import type { ChatDetailDTO, MessageDTO, PublicUser } from '@/types';

const DAY_FORMAT = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return DAY_FORMAT.format(date);
}

/**
 * Thread scroller. Older pages load when the top comes into view and the scroll
 * offset is restored afterwards, so reading never jumps. Off-screen bubbles are
 * skipped by the browser via `content-visibility`, which keeps very long threads
 * cheap without breaking scroll anchoring the way a fixed-height virtual list
 * would (bubbles have wildly different heights).
 */
export function MessageList({
  chatId,
  chat,
  messages,
  hasMore,
  loadingMore,
  onLoadOlder,
  me,
}: {
  chatId: string;
  chat?: ChatDetailDTO;
  messages: MessageDTO[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadOlder: () => void;
  me: PublicUser;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const [stuck, setStuck] = useState(true);
  const { socket } = useSocketContext();
  const markRead = useChatStore((s) => s.markRead);
  const lastReadSent = useRef<string | null>(null);

  const nearBottom = useCallback(() => {
    const el = scroller.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  }, []);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setStuck(nearBottom());
    if (el.scrollTop < 260 && hasMore && !loadingMore) {
      anchor.current = { height: el.scrollHeight, top: el.scrollTop };
      onLoadOlder();
    }
  }, [hasMore, loadingMore, nearBottom, onLoadOlder]);

  // Restore the reading position after older messages are spliced in above.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !anchor.current) return;
    const delta = el.scrollHeight - anchor.current.height;
    if (delta > 0) el.scrollTop = anchor.current.top + delta;
    anchor.current = null;
  }, [messages.length]);

  useEffect(() => {
    if (stuck) bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, stuck]);

  // Report the newest incoming message as read while the thread is visible.
  useEffect(() => {
    if (!socket || !stuck || document.visibilityState !== 'visible') return;
    const incoming = [...messages].reverse().find((m) => m.senderId && m.senderId !== me.id && !m.pending);
    if (!incoming || lastReadSent.current === incoming.id) return;
    lastReadSent.current = incoming.id;
    socket.emit('message:read', { chatId, messageId: incoming.id });
    markRead(chatId, incoming.id, me.id);
  }, [socket, stuck, messages, chatId, me.id, markRead]);

  const unreadJump = !stuck && messages.length > 0;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        className="h-full overflow-y-auto overflow-x-hidden px-2 py-3 sm:px-4"
        role="log"
        aria-live="polite"
        aria-label="Сообщения"
      >
        {hasMore ? (
          <div className="flex justify-center py-3">
            {loadingMore ? (
              <Loader2 className="h-5 w-5 animate-spin text-accent" aria-label="Загрузка" />
            ) : (
              <button onClick={onLoadOlder} className="press glass rounded-xl px-3 py-1.5 text-xs font-semibold text-ink-soft">
                Показать более старые
              </button>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-ink-faint">Начало переписки</div>
        )}

        {messages.map((message, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(message.createdAt);
          const gapMinutes = prev ? (new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime()) / 60_000 : 99;
          const grouped =
            !newDay &&
            prev?.senderId === message.senderId &&
            message.contentType !== 'SYSTEM' &&
            prev?.contentType !== 'SYSTEM' &&
            gapMinutes < 5;
          const lastOfGroup =
            !next ||
            next.senderId !== message.senderId ||
            (new Date(next.createdAt).getTime() - new Date(message.createdAt).getTime()) / 60_000 >= 5;

          return (
            <div key={message.clientId ?? message.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 64px' }}>
              {newDay ? (
                <div className="sticky top-0 z-10 flex justify-center py-2">
                  <span className="glass rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                    {dayLabel(message.createdAt)}
                  </span>
                </div>
              ) : null}
              <MessageBubble
                message={message}
                chat={chat}
                me={me}
                grouped={grouped}
                lastOfGroup={lastOfGroup}
                showAuthor={chat?.type !== 'DM'}
              />
            </div>
          );
        })}

        <TypingIndicator chatId={chatId} />
        <div ref={bottom} className="h-1" />
      </div>

      <button
        onClick={() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
        className={cn(
          'glass-strong press absolute bottom-4 end-4 flex h-11 w-11 items-center justify-center rounded-full shadow-glass-lg transition-all duration-300',
          stuck ? 'pointer-events-none translate-y-4 opacity-0' : 'opacity-100',
        )}
        aria-label="Вниз"
        aria-hidden={stuck}
      >
        <ArrowDown className="h-5 w-5 text-ink" aria-hidden />
        {unreadJump ? (
          <span className="absolute -top-1 -end-1 h-3 w-3 rounded-full bg-accent-gradient shadow-glow" aria-hidden />
        ) : null}
      </button>
    </div>
  );
}
