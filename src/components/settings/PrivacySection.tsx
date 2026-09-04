'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldOff, UserX } from 'lucide-react';
import { api } from '@/lib/api';
import { ensureKeyPair } from '@/lib/e2e';
import { toast } from '@/store/toast';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Switch, Segmented } from '@/components/ui/Switch';
import { SettingsCard, Row } from './SettingsCard';

type Reach = 'EVERYONE' | 'CONTACTS' | 'NOBODY';

const REACH: { value: Reach; label: string }[] = [
  { value: 'EVERYONE', label: 'Все' },
  { value: 'CONTACTS', label: 'Кто в общих чатах' },
  { value: 'NOBODY', label: 'Никто' },
];

interface BlockRow {
  id: string;
  blocked: { id: string; name: string; username: string; avatarUrl: string | null; verified: boolean };
}

/** Who may reach me, what I broadcast, my block list and my E2E key. */
export function PrivacySection({
  initial,
}: {
  initial: { whoCanMessage: Reach; showPresence: boolean; showReadState: boolean; e2ePublicKey: string | null };
}) {
  const queryClient = useQueryClient();
  const [whoCanMessage, setReach] = useState<Reach>(initial.whoCanMessage);
  const [showPresence, setShowPresence] = useState(initial.showPresence);
  const [showReadState, setShowReadState] = useState(initial.showReadState);
  const [hasKey, setHasKey] = useState(Boolean(initial.e2ePublicKey));
  const [keyBusy, setKeyBusy] = useState(false);

  const sync = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch('/api/users/me', patch),
    onError: (err: Error) => toast.error('Не сохранилось', err.message),
  });

  const blocks = useQuery({
    queryKey: ['blocks'],
    queryFn: () => api.get<{ blocks: BlockRow[] }>('/api/users/block'),
  });

  const unblock = useMutation({
    mutationFn: (userId: string) => api.del(`/api/users/block?userId=${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      toast.success('Разблокирован');
    },
  });

  /** Generates the key pair locally and publishes only the public half. */
  async function makeKey() {
    setKeyBusy(true);
    try {
      const { publicKey } = await ensureKeyPair();
      await api.patch('/api/users/me', { e2ePublicKey: publicKey });
      setHasKey(true);
      toast.success('Ключ создан', 'Приватная часть осталась в этом браузере');
    } catch (err) {
      toast.error('Ключ не создан', (err as Error).message);
    } finally {
      setKeyBusy(false);
    }
  }

  return (
    <SettingsCard title="Приватность" description="Видимость и доступ" icon={<ShieldOff className="h-4 w-4" />}>
      <Row label="Кто может писать мне первым">
        <Segmented
          value={whoCanMessage}
          onChange={(value) => {
            setReach(value);
            sync.mutate({ whoCanMessage: value });
          }}
          options={REACH}
        />
      </Row>

      <Switch
        checked={showPresence}
        onChange={(value) => {
          setShowPresence(value);
          sync.mutate({ showPresence: value });
        }}
        label="Показывать, когда я в сети"
        description="Выключено — другие видят только «был(а) недавно»"
      />
      <Switch
        checked={showReadState}
        onChange={(value) => {
          setShowReadState(value);
          sync.mutate({ showReadState: value });
        }}
        label="Отправлять отметки о прочтении"
        description="Взаимно: без них вы тоже не увидите вторую галочку"
      />

      <div className="rounded-2xl bg-glass/50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <KeyRound className="h-4 w-4" /> Ключ шифрования
            </p>
            <p className="text-xs text-ink-faint">
              {hasKey
                ? 'Ключ опубликован — E2E можно включить в настройках личного чата'
                : 'Нужен для сквозного шифрования личных чатов и заметок'}
            </p>
          </div>
          <Button variant={hasKey ? 'glass' : 'primary'} onClick={makeKey} loading={keyBusy}>
            {hasKey ? 'Перевыпустить' : 'Создать'}
          </Button>
        </div>
        {hasKey ? (
          <p className="mt-2 text-xs text-amber-500">
            Перевыпуск сделает нечитаемыми старые зашифрованные сообщения на других устройствах.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <UserX className="h-4 w-4" /> Заблокированные
          {blocks.data?.blocks.length ? (
            <span className="rounded-full bg-glass px-2 text-xs text-ink-faint">{blocks.data.blocks.length}</span>
          ) : null}
        </p>
        {blocks.isLoading ? (
          <p className="text-xs text-ink-faint">Загрузка…</p>
        ) : blocks.data?.blocks.length ? (
          <ul className="space-y-1.5">
            {blocks.data.blocks.map((row) => (
              <li key={row.id} className="flex items-center gap-2 rounded-2xl bg-glass/50 p-2">
                <Avatar name={row.blocked.name} src={row.blocked.avatarUrl} userId={row.blocked.id} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {row.blocked.name} <span className="font-mono text-xs text-ink-faint">@{row.blocked.username}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => unblock.mutate(row.blocked.id)}>
                  Разблокировать
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-faint">Список пуст — и это хорошо.</p>
        )}
      </div>
    </SettingsCard>
  );
}
