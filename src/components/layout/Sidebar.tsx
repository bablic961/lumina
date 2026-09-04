'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, Command, Plus, Search, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useChats } from '@/hooks/useChats';
import { useChatStore } from '@/store/chat';
import { useUi } from '@/store/ui';
import { useMe } from '@/components/providers/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import { ChatListSkeleton } from '@/components/ui/Skeleton';
import { ChatListItem } from '@/components/chat/ChatListItem';
import { NewChatModal } from '@/components/chat/NewChatModal';
import { PresenceMenu } from '@/components/layout/PresenceMenu';

interface FolderDTO {
  id: string;
  name: string;
  emoji: string | null;
}

export function Sidebar() {
  const { me } = useMe();
  const { isLoading } = useChats();
  const chats = useChatStore((s) => s.chats);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'unread' | 'archive' | string>('all');
  const [newChat, setNewChat] = useState(false);
  const set = useUi((s) => s.set);

  const folders = useQuery({
    queryKey: ['folders'],
    queryFn: () => api.get<{ folders: FolderDTO[] }>('/api/folders'),
    staleTime: 5 * 60_000,
  });

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return chats.filter((chat) => {
      if (tab === 'archive') {
        if (!chat.isArchived) return false;
      } else if (chat.isArchived) {
        return false;
      }
      if (tab === 'unread' && chat.unreadCount === 0) return false;
      if (!['all', 'unread', 'archive'].includes(tab) && chat.folderId !== tab) return false;
      if (!needle) return true;
      return (
        chat.title.toLowerCase().includes(needle) ||
        (chat.peer?.username ?? '').toLowerCase().includes(needle) ||
        (chat.lastMessage?.content ?? '').toLowerCase().includes(needle)
      );
    });
  }, [chats, query, tab]);

  const unreadTotal = chats.reduce((sum, c) => sum + (c.isArchived ? 0 : c.unreadCount), 0);

  const tabs = [
    { id: 'all', label: 'Все' },
    { id: 'unread', label: `Непрочитанные${unreadTotal ? ` ${unreadTotal}` : ''}` },
    ...(folders.data?.folders ?? []).map((f) => ({ id: f.id, label: `${f.emoji ?? ''} ${f.name}`.trim() })),
    { id: 'archive', label: 'Архив' },
  ];

  return (
    <div className="flex h-full flex-col bg-canvas/40">
      <header className="flex items-center gap-2 px-4 pb-2 pt-4">
        <span className="logo-font flex-1 text-2xl font-extrabold text-gradient md:hidden">Lumina</span>
        <h1 className="hidden flex-1 text-lg font-extrabold tracking-tight text-ink md:block">Чаты</h1>
        <PresenceMenu
          trigger={
            <button className="press rounded-full" aria-label="Статус">
              <Avatar name={me.name} src={me.avatarUrl} userId={me.id} size="sm" presence={me.presence} />
            </button>
          }
        />
        <button
          onClick={() => setNewChat(true)}
          className="press flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-gradient text-white shadow-glow transition-shadow hover:shadow-glow-lg"
          aria-label="Новый чат"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <div className="px-4 pb-3">
        <div className="glass flex h-11 items-center gap-2 rounded-2xl px-3 transition-shadow focus-within:shadow-ring">
          <Search className="h-4 w-4 text-ink-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск чатов и сообщений"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            aria-label="Поиск"
          />
          <button
            onClick={() => set('commandOpen', true)}
            className="hidden items-center gap-0.5 rounded-lg bg-glass/70 px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint md:flex"
            aria-label="Открыть палитру команд"
          >
            <Command className="h-3 w-3" aria-hidden />K
          </button>
        </div>
      </div>

      <div className="scrollbar-none flex gap-1.5 overflow-x-auto px-4 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'press shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-300',
              tab === t.id ? 'bg-accent-gradient text-white shadow-glow' : 'glass text-ink-soft hover:text-ink',
            )}
          >
            {t.id === 'archive' ? <Archive className="me-1 inline h-3 w-3" aria-hidden /> : null}
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-24 md:pb-3">
        {isLoading ? (
          <ChatListSkeleton />
        ) : visible.length === 0 ? (
          <EmptyState query={query} onCreate={() => setNewChat(true)} />
        ) : (
          <ul className="space-y-1">
            {visible.map((chat) => (
              <ChatListItem key={chat.id} chat={chat} />
            ))}
          </ul>
        )}
      </div>

      <NewChatModal open={newChat} onClose={() => setNewChat(false)} />
    </div>
  );
}

function EmptyState({ query, onCreate }: { query: string; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="glass flex h-14 w-14 items-center justify-center rounded-2xl">
        <Sparkles className="h-6 w-6 text-accent" aria-hidden />
      </div>
      <p className="text-sm text-ink-soft">
        {query ? 'Ничего не найдено' : 'Здесь пока пусто — начните первый разговор'}
      </p>
      {!query ? (
        <button onClick={onCreate} className="press text-xs font-semibold text-accent">
          Создать чат
        </button>
      ) : null}
    </div>
  );
}
