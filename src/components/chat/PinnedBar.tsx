'use client';

import { useMemo, useState } from 'react';
import { Pin, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chat';
import type { MessageDTO } from '@/types';

/** Strip above the thread listing pinned messages; tap cycles and scrolls to one. */
export function PinnedBar({ chatId, messages }: { chatId: string; messages: MessageDTO[] }) {
  const [index, setIndex] = useState(0);
  const setPinned = useChatStore((s) => s.setPinned);

  const pinned = useMemo(
    () => messages.filter((m) => m.isPinned && !m.deletedForAll),
    [messages],
  );
  if (pinned.length === 0) return null;

  const current = pinned[index % pinned.length];

  function jump() {
    setIndex((i) => i + 1);
    document.getElementById(`msg-${current.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function unpin() {
    setPinned(chatId, current.id, false);
    await api.patch(`/api/messages/${current.id}`, { isPinned: false }).catch(() => {});
  }

  return (
    <div className="glass flex shrink-0 items-center gap-2 border-b border-hairline px-3 py-2">
      <Pin className="h-4 w-4 shrink-0 text-accent" aria-hidden />
      <button onClick={jump} className="min-w-0 flex-1 text-start">
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent">
          Закреплённое {pinned.length > 1 ? `${(index % pinned.length) + 1}/${pinned.length}` : ''}
        </p>
        <p className="truncate text-xs text-ink-soft">
          {current.contentType === 'TEXT' ? current.content : `[${current.contentType.toLowerCase()}]`}
        </p>
      </button>
      <button
        onClick={unpin}
        className="press flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-glass/70 hover:text-ink"
        aria-label="Открепить"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
