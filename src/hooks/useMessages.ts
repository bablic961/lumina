'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chat';
import type { MessageDTO } from '@/types';

interface Page {
  messages: MessageDTO[];
  hasMore: boolean;
  nextCursor: string | null;
}

/**
 * History loader: first page on mount, then 50 older messages each time the
 * scroller nears the top. The store holds the merged list so socket updates and
 * pagination cannot fight each other.
 *
 * `around` loads the window centred on one message instead of the newest page —
 * that is how deep links from search and saved messages land on their target.
 */
export function useMessages(chatId: string | null, around?: string | null) {
  const { setMessages, prependMessages } = useChatStore();
  const messages = useChatStore((s) => (chatId ? s.messages[chatId] : undefined));
  const hasMore = useChatStore((s) => (chatId ? s.hasMore[chatId] : false));
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<string | null>(null);

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    setLoading(true);
    cursor.current = null;

    api
      .get<Page>(`/api/chats/${chatId}/messages${around ? `?around=${encodeURIComponent(around)}` : ''}`)
      .then((page) => {
        if (cancelled) return;
        setMessages(chatId, page.messages, page.hasMore);
        // The `around` window carries no cursor, so keep paging from its oldest row.
        cursor.current = page.nextCursor ?? page.messages[0]?.id ?? null;
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [chatId, around, setMessages]);

  const loadOlder = useCallback(async () => {
    if (!chatId || !cursor.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.get<Page>(`/api/chats/${chatId}/messages?cursor=${cursor.current}`);
      prependMessages(chatId, page.messages, page.hasMore);
      cursor.current = page.nextCursor;
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, loadingMore, prependMessages]);

  return { messages: messages ?? [], hasMore: Boolean(hasMore), loading, loadingMore, loadOlder };
}
