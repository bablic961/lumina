'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Hash, Search, Users, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Avatar } from '@/components/ui/Avatar';
import type { ChatType, PublicUser } from '@/types';

const TABS: { type: ChatType; label: string; icon: React.ReactNode; hint: string }[] = [
  { type: 'DM', label: 'Диалог', icon: <Users className="h-4 w-4" aria-hidden />, hint: 'Личная переписка' },
  { type: 'GROUP', label: 'Группа', icon: <Users className="h-4 w-4" aria-hidden />, hint: 'До 2000 участников' },
  { type: 'CHANNEL', label: 'Канал', icon: <Hash className="h-4 w-4" aria-hidden />, hint: 'Пишут только админы' },
];

export function NewChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [type, setType] = useState<ChatType>('DM');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [title, setTitle] = useState('');
  const [e2e, setE2e] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelected([]);
      setTitle('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const data = await api
        .get<{ users: PublicUser[] }>(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        .catch(() => null);
      setResults(data?.users ?? []);
    }, 260);
    return () => clearTimeout(timer);
  }, [query]);

  const canCreate = useMemo(
    () => (type === 'DM' ? selected.length === 1 : Boolean(title.trim()) && selected.length >= 1),
    [type, selected, title],
  );

  async function create() {
    if (!canCreate) return;
    setBusy(true);
    try {
      const { chatId } = await api.post<{ chatId: string }>('/api/chats', {
        type,
        title: type === 'DM' ? undefined : title.trim(),
        memberIds: selected.map((u) => u.id),
        e2eEnabled: type === 'DM' ? e2e : false,
      });
      await queryClient.invalidateQueries({ queryKey: ['chats'] });
      onClose();
      router.push(`/app/chat/${chatId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Не удалось создать чат');
    } finally {
      setBusy(false);
    }
  }

  function toggle(user: PublicUser) {
    setSelected((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      if (exists) return prev.filter((u) => u.id !== user.id);
      return type === 'DM' ? [user] : [...prev, user];
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый чат"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={create} loading={busy} disabled={!canCreate}>
            {type === 'DM' ? 'Открыть диалог' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="glass grid grid-cols-3 gap-1 rounded-2xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.type}
              onClick={() => {
                setType(tab.type);
                setSelected([]);
              }}
              className={cn(
                'press flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs font-semibold transition',
                type === tab.type ? 'bg-accent-gradient text-white shadow-glow' : 'text-ink-soft hover:text-ink',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-center text-[11px] text-ink-faint">{TABS.find((t) => t.type === type)?.hint}</p>

        {type !== 'DM' ? (
          <Input
            label="Название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === 'CHANNEL' ? 'Новости Lumina' : 'Рабочая группа'}
            maxLength={80}
          />
        ) : (
          <Switch
            checked={e2e}
            onChange={setE2e}
            label="Сквозное шифрование"
            description="Сообщения шифруются в браузере — сервер видит только шифртекст"
          />
        )}

        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((user) => (
              <button
                key={user.id}
                onClick={() => toggle(user)}
                className="glass press flex items-center gap-1.5 rounded-full py-0.5 pe-2 ps-0.5 text-xs font-semibold"
              >
                <Avatar name={user.name} src={user.avatarUrl} userId={user.id} size="xs" />
                {user.name}
                <X className="h-3 w-3 text-ink-faint" aria-hidden />
              </button>
            ))}
          </div>
        ) : null}

        <div className="glass flex h-11 items-center gap-2 rounded-2xl px-3 focus-within:shadow-ring">
          <Search className="h-4 w-4 text-ink-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти по имени или @username"
            aria-label="Поиск пользователей"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
          />
        </div>

        <div className="max-h-56 space-y-1 overflow-y-auto">
          {results.length === 0 && query.trim().length >= 2 ? (
            <p className="py-6 text-center text-xs text-ink-soft">Никого не найдено</p>
          ) : null}
          {results.map((user) => {
            const chosen = selected.some((u) => u.id === user.id);
            return (
              <button
                key={user.id}
                onClick={() => toggle(user)}
                className={cn(
                  'glass-hover flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-start transition',
                  chosen && 'glass shadow-glow',
                )}
              >
                <Avatar
                  name={user.name}
                  src={user.avatarUrl}
                  userId={user.id}
                  size="sm"
                  presence={user.presence}
                  verified={user.verified}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">{user.name}</span>
                  <span className="block truncate text-xs text-ink-faint">@{user.username}</span>
                </span>
                {chosen ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
