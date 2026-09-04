'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  Hash,
  Home,
  Lock,
  Moon,
  Search,
  Settings,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUi, resolveTheme } from '@/store/ui';
import { useMe } from '@/components/providers/MeProvider';
import { Avatar } from '@/components/ui/Avatar';
import type { ChatType, ContentType, MessageDTO, PublicUser } from '@/types';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
  keywords?: string;
}

interface SearchPayload {
  chats: { id: string; title: string | null; type: ChatType; avatarUrl: string | null }[];
  users: PublicUser[];
  messages: (MessageDTO & { chat: { id: string; title: string | null; type: ChatType } })[];
}

const PREVIEW: Partial<Record<ContentType, string>> = {
  VOICE: '🎙 Голосовое',
  FILE: '📎 Файл',
  STICKER: '🌟 Стикер',
  POLL: '📊 Опрос',
  CALL: '📞 Звонок',
};

/** Ctrl/⌘+K launcher: fuzzy actions plus live search over chats, people and messages. */
export function CommandPalette() {
  const router = useRouter();
  const { commandOpen, set, theme, toggleFocus } = useUi();
  const { isAdmin } = useMe();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    set('commandOpen', false);
    setQuery('');
    setCursor(0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        set('commandOpen', !useUi.getState().commandOpen);
      }
      if (e.key === 'Escape' && useUi.getState().commandOpen) set('commandOpen', false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [set]);

  useEffect(() => {
    if (commandOpen) setTimeout(() => inputRef.current?.focus(), 40);
  }, [commandOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const { data } = useQuery({
    queryKey: ['command-search', debounced],
    queryFn: () => api.get<SearchPayload>(`/api/search?q=${encodeURIComponent(debounced)}`),
    enabled: commandOpen && debounced.length >= 2,
  });

  const actions = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      close();
    };
    const list: Command[] = [
      { id: 'home', label: 'Все чаты', icon: <Home className="h-4 w-4" aria-hidden />, run: go('/app'), keywords: 'чаты home' },
      { id: 'saved', label: 'Сохранённые сообщения', icon: <Bookmark className="h-4 w-4" aria-hidden />, run: go('/app/saved'), keywords: 'закладки saved' },
      { id: 'notes', label: 'Зашифрованные заметки', icon: <Lock className="h-4 w-4" aria-hidden />, run: go('/app/notes'), keywords: 'notes заметки' },
      { id: 'stories', label: 'Истории', icon: <Sparkles className="h-4 w-4" aria-hidden />, run: go('/app/stories'), keywords: 'stories истории' },
      { id: 'settings', label: 'Настройки', icon: <Settings className="h-4 w-4" aria-hidden />, run: go('/app/settings'), keywords: 'settings профиль тема' },
      {
        id: 'focus',
        label: 'Фокус-режим',
        hint: 'Скрыть всё, кроме переписки',
        icon: <Target className="h-4 w-4" aria-hidden />,
        run: () => {
          toggleFocus();
          close();
        },
        keywords: 'focus фокус',
      },
      {
        id: 'theme',
        label: `Тема: ${resolveTheme(theme) === 'light' ? 'светлая' : 'тёмная'} → переключить`,
        icon: <Moon className="h-4 w-4" aria-hidden />,
        run: () => {
          const order = ['light', 'dark', 'amoled', 'auto'] as const;
          set('theme', order[(order.indexOf(theme) + 1) % order.length]);
          close();
        },
        keywords: 'theme тема dark light',
      },
    ];
    if (isAdmin) {
      list.push({
        id: 'admin',
        label: 'Админ-панель',
        icon: <Settings className="h-4 w-4" aria-hidden />,
        run: go('/app/admin'),
        keywords: 'admin админ',
      });
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(q));
  }, [router, query, theme, set, toggleFocus, isAdmin]);

  const items = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      close();
    };
    const chats: Command[] = (data?.chats ?? []).map((chat) => ({
      id: `chat-${chat.id}`,
      label: chat.title || 'Чат',
      hint: chat.type === 'CHANNEL' ? 'канал' : chat.type === 'GROUP' ? 'группа' : 'диалог',
      icon: chat.type === 'CHANNEL' ? <Hash className="h-4 w-4" aria-hidden /> : <Users className="h-4 w-4" aria-hidden />,
      run: go(`/app/chat/${chat.id}`),
    }));
    const users: Command[] = (data?.users ?? []).map((user) => ({
      id: `user-${user.id}`,
      label: user.name,
      hint: `@${user.username}`,
      icon: <Avatar name={user.name} src={user.avatarUrl} userId={user.id} size="xs" />,
      run: go(`/app/u/${user.username}`),
    }));
    const messages: Command[] = (data?.messages ?? []).slice(0, 12).map((message) => ({
      id: `message-${message.id}`,
      label: PREVIEW[message.contentType] ?? message.content.slice(0, 80),
      hint: `${message.chat.title || 'Диалог'} · ${new Date(message.createdAt).toLocaleDateString('ru-RU')}`,
      icon: <Search className="h-4 w-4" aria-hidden />,
      run: go(`/app/chat/${message.chatId}`),
    }));
    return [...actions, ...chats, ...users, ...messages];
  }, [actions, data, router]);

  useEffect(() => setCursor(0), [debounced, commandOpen]);

  if (!commandOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal>
      <button className="absolute inset-0 cursor-default bg-slate-900/25 backdrop-blur-sm" onClick={close} aria-label="Закрыть" />

      <div className="glass-strong animate-unfold relative w-full max-w-xl overflow-hidden rounded-3xl shadow-glass-lg">
        <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
          <Search className="h-4 w-4 text-ink-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, items.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                items[cursor]?.run();
              }
            }}
            placeholder="Поиск чатов, людей, сообщений или команда…"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="rounded-lg bg-glass/70 px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-ink-faint">
              {debounced.length >= 2 ? 'Ничего не найдено' : 'Введите запрос или выберите действие'}
            </p>
          ) : (
            items.map((item, index) => {
              const group = groupOf(item.id);
              const showHeader = index === 0 || groupOf(items[index - 1]!.id) !== group;
              const active = index === cursor;
              return (
                <div key={item.id}>
                  {showHeader ? (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{group}</p>
                  ) : null}
                  <button
                    ref={(node) => {
                      if (active) node?.scrollIntoView({ block: 'nearest' });
                    }}
                    onMouseEnter={() => setCursor(index)}
                    onClick={item.run}
                    className={cn(
                      'press flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-start transition',
                      active ? 'bg-accent-gradient text-white shadow-glow' : 'text-ink hover:bg-glass/70',
                    )}
                  >
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center', !active && 'text-ink-soft')}>
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{item.label}</span>
                    {item.hint ? (
                      <span className={cn('max-w-[40%] shrink-0 truncate text-xs', active ? 'text-white/75' : 'text-ink-faint')}>
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-hairline px-4 py-2 text-[11px] text-ink-faint">
          <span>
            <kbd className="font-mono">↑↓</kbd> навигация
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> открыть
          </span>
          <span className="ms-auto font-mono">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

const GROUPS: Record<string, string> = {
  chat: 'Чаты',
  user: 'Люди',
  message: 'Сообщения',
};

/** Section label for a flattened row: search rows carry a prefix, actions do not. */
function groupOf(id: string) {
  return GROUPS[id.split('-')[0] ?? ''] ?? 'Действия';
}
