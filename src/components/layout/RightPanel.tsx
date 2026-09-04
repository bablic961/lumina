'use client';

import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useUi } from '@/store/ui';
import { ChatInfoPanel } from '@/components/chat/ChatInfoPanel';
import { MediaGallery } from '@/components/chat/MediaGallery';
import { MembersPanel } from '@/components/chat/MembersPanel';
import { ChatSearchPanel } from '@/components/chat/ChatSearchPanel';
import type { ChatDetailResponse } from '@/types';

const TITLES = {
  info: 'Информация',
  media: 'Медиа и файлы',
  members: 'Участники',
  search: 'Поиск в чате',
} as const;

export function RightPanel({ chatId }: { chatId: string }) {
  const { rightPanel, set } = useUi();

  const detail = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => api.get<ChatDetailResponse>(`/api/chats/${chatId}`),
  });

  if (rightPanel === 'none') return null;

  return (
    <div className="flex h-full w-[21.25rem] flex-col bg-canvas/40">
      <header className="glass-strong flex h-16 shrink-0 items-center gap-2 border-b border-hairline px-4">
        <h2 className="flex-1 font-bold text-ink">{TITLES[rightPanel]}</h2>
        <button
          onClick={() => set('rightPanel', 'none')}
          className="press flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft hover:bg-glass/70"
          aria-label="Закрыть панель"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {rightPanel === 'info' ? (
          <ChatInfoPanel chatId={chatId} detail={detail.data} />
        ) : rightPanel === 'media' ? (
          <MediaGallery chatId={chatId} />
        ) : rightPanel === 'members' ? (
          <MembersPanel chatId={chatId} detail={detail.data} />
        ) : (
          <ChatSearchPanel chatId={chatId} />
        )}
      </div>
    </div>
  );
}
