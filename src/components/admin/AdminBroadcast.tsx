'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Megaphone, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Switch';
import type { Importance } from '@/types';

const LEVELS: { value: Importance; label: string }[] = [
  { value: 'LOW', label: 'Тихо' },
  { value: 'NORMAL', label: 'Обычно' },
  { value: 'HIGH', label: 'Важно' },
];

/** One notification to every non-banned account. */
export function AdminBroadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [importance, setImportance] = useState<Importance>('NORMAL');

  const send = useMutation({
    mutationFn: () => api.post<{ recipients: number }>('/api/admin/broadcast', { title, body, importance }),
    onSuccess: ({ recipients }) => {
      setTitle('');
      setBody('');
      toast.success('Рассылка отправлена', `Получателей: ${recipients}`);
    },
    onError: (err: Error) => toast.error('Не отправилось', err.message),
  });

  return (
    <div className="glass mx-auto max-w-xl space-y-3 rounded-3xl p-5">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-accent-from" aria-hidden />
        <h2 className="text-sm font-extrabold text-ink">Рассылка</h2>
      </div>
      <p className="text-xs text-ink-faint">
        Уведомление получат все незаблокированные пользователи. Push-доставку выполняет socket-сервер, у которого
        лежат VAPID-ключи.
      </p>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} label="Заголовок" maxLength={120} />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={1000}
        placeholder="Текст (необязательно)"
        aria-label="Текст рассылки"
      />
      <div className="flex items-center justify-between gap-3">
        <Segmented value={importance} onChange={setImportance} options={LEVELS} />
        <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!title.trim()}>
          <Send className="h-4 w-4" /> Отправить
        </Button>
      </div>
    </div>
  );
}
