'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import type { ContentType, MessageDTO } from '@/types';

const KINDS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'TEXT', label: 'Текст' },
  { value: 'FILE', label: 'Файлы' },
  { value: 'VOICE', label: 'Голос' },
  { value: 'CODE', label: 'Код' },
  { value: 'POLL', label: 'Опросы' },
];

const PREVIEW: Partial<Record<ContentType, string>> = {
  VOICE: '🎙 Голосовое сообщение',
  FILE: '📎 Файл',
  STICKER: '🌟 Стикер',
  LOCATION: '📍 Геолокация',
  POLL: '📊 Опрос',
  CALL: '📞 Звонок',
};

/** Highlights every occurrence of the query inside a result snippet. */
function Snippet({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded bg-accent-from/25 text-ink">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

type Result = MessageDTO & { chat: { id: string; title: string | null; type: string } };

/** In-chat search: debounced query, type filters, jump-to-message. */
export function ChatSearchPanel({ chatId }: { chatId: string }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [kind, setKind] = useState('ALL');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 280);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ['chat-search', chatId, debounced, kind],
    queryFn: () =>
      api.get<{ messages: Result[] }>(
        `/api/search?chatId=${chatId}&kind=${kind}&q=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced.length > 0 || kind !== 'ALL',
  });

  const messages = data?.messages ?? [];

  /** Messages outside the loaded window are not in the DOM yet. */
  function jump(id: string) {
    const node = document.getElementById(`msg-${id}`);
    if (!node) {
      toast.info('Сообщение ещё не загружено', 'Прокрутите переписку выше и повторите');
      return;
    }
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('ring-2', 'ring-accent-from', 'rounded-2xl');
    setTimeout(() => node.classList.remove('ring-2', 'ring-accent-from', 'rounded-2xl'), 1600);
  }

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Искать в этом чате"
        icon={<Search className="h-4 w-4" aria-hidden />}
        autoFocus
      />

      <div className="flex flex-wrap gap-1">
        {KINDS.map((option) => (
          <button
            key={option.value}
            onClick={() => setKind(option.value)}
            className={cn(
              'press rounded-xl px-2.5 py-1 text-xs font-semibold transition',
              kind === option.value ? 'bg-accent-gradient text-white shadow-glow' : 'bg-glass/70 text-ink-soft',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isFetching ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-faint">
          {debounced || kind !== 'ALL' ? 'Ничего не найдено' : 'Введите запрос'}
        </p>
      ) : (
        <ul className="space-y-1">
          {messages.map((message) => (
            <li key={message.id}>
              <button
                onClick={() => jump(message.id)}
                className="press flex w-full items-start gap-2.5 rounded-2xl px-2 py-2 text-start transition hover:bg-glass/70"
              >
                <Avatar
                  name={message.sender?.name ?? 'Система'}
                  src={message.sender?.avatarUrl}
                  userId={message.senderId ?? message.id}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {message.sender?.name ?? 'Системное'}
                    </span>
                    <span className="shrink-0 text-[10px] text-ink-faint">
                      {new Date(message.createdAt).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </span>
                  <span className="line-clamp-2 block text-xs text-ink-soft">
                    {PREVIEW[message.contentType] ?? <Snippet text={message.content} query={debounced} />}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
