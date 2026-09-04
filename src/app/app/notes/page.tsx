'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Lock, LockOpen, NotebookPen, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { openNote, sealNote } from '@/lib/e2e';
import { cn } from '@/lib/utils';
import { toast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

interface NoteRow {
  id: string;
  title: string;
  cipherText: string;
  iv: string;
  createdAt: string;
  updatedAt: string;
}

const when = (value: string) =>
  new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Zero-knowledge notes. The passphrase never leaves this component: notes are
 * sealed with AES-GCM before the request and opened after the response, so the
 * server only ever holds ciphertext.
 */
export default function NotesPage() {
  const queryClient = useQueryClient();
  const [passphrase, setPassphrase] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [plain, setPlain] = useState<Record<string, string>>({});

  const notes = useQuery({
    queryKey: ['notes'],
    queryFn: () => api.get<{ notes: NoteRow[] }>('/api/notes'),
    enabled: unlocked,
  });

  const rows = useMemo(() => notes.data?.notes ?? [], [notes.data]);

  // Decrypt whatever the passphrase can open; the rest stay marked as locked.
  useEffect(() => {
    if (!unlocked || rows.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const note of rows) {
        try {
          next[note.id] = await openNote(passphrase, note.cipherText, note.iv);
        } catch {
          // Wrong passphrase for this note — leave it out of the map.
        }
      }
      if (!cancelled) setPlain(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, passphrase, unlocked]);

  const create = useMutation({
    mutationFn: async () => {
      const sealed = await sealNote(passphrase, body);
      return api.post<{ note: NoteRow }>('/api/notes', { title: title.trim() || 'Без названия', ...sealed });
    },
    onSuccess: ({ note }) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setActiveId(note.id);
      toast.success('Заметка зашифрована');
    },
    onError: (err: Error) => toast.error('Не сохранилось', err.message),
  });

  const update = useMutation({
    mutationFn: async (id: string) => {
      const sealed = await sealNote(passphrase, body);
      return api.patch(`/api/notes?id=${id}`, { title: title.trim() || 'Без названия', ...sealed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Сохранено');
    },
    onError: (err: Error) => toast.error('Не сохранилось', err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/notes?id=${id}`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      if (activeId === id) {
        setActiveId(null);
        setTitle('');
        setBody('');
      }
    },
  });

  function open(note: NoteRow) {
    setActiveId(note.id);
    setTitle(note.title);
    setBody(plain[note.id] ?? '');
  }

  if (!unlocked) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (passphrase.length < 6) {
              toast.error('Слишком короткая фраза', 'Минимум 6 символов');
              return;
            }
            setUnlocked(true);
          }}
          className="glass w-full max-w-sm space-y-4 rounded-3xl p-6 text-center"
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-accent-gradient text-white shadow-glow">
            <Lock className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-extrabold text-ink">Зашифрованные заметки</h1>
            <p className="mt-1 text-xs text-ink-faint">
              Кодовая фраза не отправляется на сервер и нигде не сохраняется. Забудете — заметки не восстановить.
            </p>
          </div>
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            label="Кодовая фраза"
            autoComplete="off"
            icon={<KeyRound className="h-4 w-4" />}
          />
          <Button type="submit" className="w-full">
            <LockOpen className="h-4 w-4" /> Открыть хранилище
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex min-h-0 flex-1 flex-col border-e border-hairline md:max-w-xs">
        <header className="glass-strong flex items-center gap-2 border-b border-hairline px-4 py-3">
          <NotebookPen className="h-5 w-5 text-ink-soft" aria-hidden />
          <h1 className="flex-1 truncate text-sm font-extrabold text-ink">Заметки</h1>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Новая заметка"
            onClick={() => {
              setActiveId(null);
              setTitle('');
              setBody('');
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 pb-24 md:pb-3">
          {notes.isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-14 w-full rounded-2xl" />)
          ) : rows.length === 0 ? (
            <p className="p-4 text-center text-xs text-ink-faint">Пока пусто. Создайте первую заметку.</p>
          ) : (
            rows.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => open(note)}
                className={cn(
                  'w-full rounded-2xl p-3 text-start transition hover:shadow-glow',
                  activeId === note.id ? 'bg-accent-gradient text-white shadow-glow' : 'bg-glass/50 text-ink',
                )}
              >
                <p className="truncate text-sm font-semibold">{note.title}</p>
                <p className={cn('truncate text-xs', activeId === note.id ? 'text-white/80' : 'text-ink-faint')}>
                  {plain[note.id] ? plain[note.id].slice(0, 60) : '🔒 другая кодовая фраза'}
                </p>
                <p className={cn('text-[10px]', activeId === note.id ? 'text-white/70' : 'text-ink-faint')}>
                  {when(note.updatedAt)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4 pb-24 md:pb-4">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Заголовок"
          maxLength={120}
          aria-label="Заголовок заметки"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Текст заметки — шифруется перед отправкой…"
          className="mt-3 min-h-0 flex-1 resize-none font-mono text-sm"
          aria-label="Текст заметки"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={() => (activeId ? update.mutate(activeId) : create.mutate())}
            loading={create.isPending || update.isPending}
            disabled={!body.trim()}
          >
            <Save className="h-4 w-4" /> {activeId ? 'Сохранить' : 'Создать'}
          </Button>
          {activeId ? (
            <Button variant="danger" onClick={() => remove.mutate(activeId)} loading={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Удалить
            </Button>
          ) : null}
          <span className="ms-auto flex items-center gap-1 text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" /> AES-GCM 256
          </span>
        </div>
      </div>
    </div>
  );
}
