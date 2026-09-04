'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Focus, LogOut, Moon, Settings, Smile, Sun, SunMoon } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUi } from '@/store/ui';
import { toast } from '@/store/toast';
import { useSocketContext } from '@/components/providers/SocketProvider';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { Presence } from '@/types';

const OPTIONS: { value: Presence; label: string; color: string }[] = [
  { value: 'ONLINE', label: 'В сети', color: 'bg-online' },
  { value: 'AWAY', label: 'Отошёл', color: 'bg-away' },
  { value: 'DND', label: 'Не беспокоить', color: 'bg-dnd' },
  { value: 'OFFLINE', label: 'Невидимка', color: 'bg-offline' },
];

/** Presence, custom emoji status, theme and focus mode in one popover. */
export function PresenceMenu({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [emoji, setEmoji] = useState('');
  const [text, setText] = useState('');
  const { theme, focusMode, set, toggleFocus } = useUi();
  const { socket } = useSocketContext();

  async function setPresence(presence: Presence) {
    socket?.emit('presence:set', { presence });
    await api.patch('/api/users/me', { presence }).catch(() => {});
    setOpen(false);
  }

  async function saveStatus() {
    await api.patch('/api/users/me', { statusEmoji: emoji || null, statusText: text || null });
    toast.success('Статус обновлён');
    setStatusOpen(false);
  }

  return (
    <>
      <div className="relative">
        <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
        {open ? (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-label="Закрыть" onClick={() => setOpen(false)} />
            <div className="glass-strong absolute end-0 top-full z-50 mt-2 w-60 origin-top-right animate-fade-in rounded-2xl p-1.5 shadow-glass-lg">
              {OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPresence(o.value)}
                  className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-glass/70"
                >
                  <span className={cn('h-2.5 w-2.5 rounded-full', o.color)} aria-hidden />
                  {o.label}
                </button>
              ))}
              <div className="my-1 h-px bg-hairline" />
              <button
                onClick={() => {
                  setStatusOpen(true);
                  setOpen(false);
                }}
                className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-glass/70"
              >
                <Smile className="h-4 w-4 text-ink-soft" aria-hidden /> Задать статус
              </button>
              <button
                onClick={() => {
                  toggleFocus();
                  setOpen(false);
                }}
                className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-glass/70"
              >
                <Focus className="h-4 w-4 text-ink-soft" aria-hidden />
                {focusMode ? 'Выйти из фокуса' : 'Режим фокуса'}
              </button>
              <button
                onClick={() => set('theme', theme === 'light' ? 'dark' : theme === 'dark' ? 'amoled' : theme === 'amoled' ? 'auto' : 'light')}
                className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-glass/70"
              >
                {theme === 'light' ? (
                  <Sun className="h-4 w-4 text-ink-soft" aria-hidden />
                ) : theme === 'auto' ? (
                  <SunMoon className="h-4 w-4 text-ink-soft" aria-hidden />
                ) : (
                  <Moon className="h-4 w-4 text-ink-soft" aria-hidden />
                )}
                Тема: {theme}
              </button>
              <Link
                href="/app/settings"
                onClick={() => setOpen(false)}
                className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-glass/70"
              >
                <Settings className="h-4 w-4 text-ink-soft" aria-hidden /> Настройки
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="press flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-rose-500 hover:bg-rose-500/10"
              >
                <LogOut className="h-4 w-4" aria-hidden /> Выйти
              </button>
            </div>
          </>
        ) : null}
      </div>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Пользовательский статус"
        description="Эмодзи и короткая подпись рядом с вашим именем"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveStatus}>Сохранить</Button>
          </>
        }
      >
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji([...e.target.value].slice(-1).join(''))}
            placeholder="🌤"
            aria-label="Эмодзи статуса"
            className="glass h-12 w-16 rounded-2xl text-center text-2xl outline-none focus:shadow-ring"
          />
          <div className="flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Работаю над Lumina"
              maxLength={64}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
