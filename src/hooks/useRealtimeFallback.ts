'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chat';
import { useSocketContext } from '@/components/providers/SocketProvider';
import type { MessageDTO } from '@/types';

const POLL_MS = 3_000;
/** Every fourth tick (~12 s) also refreshes the sidebar. */
const CHAT_LIST_EVERY = 4;

/**
 * Keeps a conversation live when the websocket cannot connect.
 *
 * Serverless hosting never runs server.js, so Socket.io simply is not there; the
 * same happens behind proxies that strip upgrades. The newest message id then
 * doubles as a poll cursor — `?after=<id>` returns whatever appeared since, and
 * the store merges it exactly as a socket event would.
 */
export function useRealtimeFallback(chatId: string | null) {
  const { connected } = useSocketContext();
  const queryClient = useQueryClient();
  const ticks = useRef(0);

  useEffect(() => {
    if (connected || !chatId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      // A hidden tab has nothing to show; skip the request but keep the loop.
      if (document.visibilityState === 'visible') {
        const list = useChatStore.getState().messages[chatId] ?? [];
        // Optimistic bubbles have no server id yet, so walk back to a real one.
        const newest = [...list].reverse().find((message) => !message.pending);
        if (newest) {
          try {
            const { messages } = await api.get<{ messages: MessageDTO[] }>(
              `/api/chats/${chatId}/messages?after=${encodeURIComponent(newest.id)}`,
            );
            for (const message of messages) useChatStore.getState().upsertMessage(message);
          } catch {
            // Offline or a server hiccup — the next tick simply tries again.
          }
        }
        ticks.current += 1;
        if (ticks.current % CHAT_LIST_EVERY === 0) queryClient.invalidateQueries({ queryKey: ['chats'] });
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [chatId, connected, queryClient]);
}
