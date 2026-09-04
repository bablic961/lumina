'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Laptop, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { SettingsCard, Row } from './SettingsCard';

interface DeviceRow {
  id: string;
  label: string;
  userAgent: string | null;
  ip: string | null;
  trusted: boolean;
  pushEnabled: boolean;
  lastActiveAt: string;
  createdAt: string;
}

const when = (value: string) =>
  new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Two-factor enrolment and the list of signed-in devices. */
export function SecuritySection() {
  const queryClient = useQueryClient();
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');

  const state = useQuery({
    queryKey: ['2fa'],
    queryFn: () => api.get<{ enabled: boolean; pending: boolean }>('/api/2fa'),
  });
  const devices = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<{ devices: DeviceRow[] }>('/api/devices'),
  });

  const start = useMutation({
    mutationFn: () => api.post<{ secret: string; otpauthUrl: string }>('/api/2fa', {}),
    onSuccess: (data) => setSecret(data),
    onError: (err: Error) => toast.error('Не удалось начать', err.message),
  });

  const confirm = useMutation({
    mutationFn: () => api.patch('/api/2fa', { code: code.trim() }),
    onSuccess: () => {
      setSecret(null);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['2fa'] });
      toast.success('2FA включена', 'Код будет спрашиваться при каждом входе');
    },
    onError: (err: Error) => toast.error('Код не принят', err.message),
  });

  const disable = useMutation({
    mutationFn: () => api.del(`/api/2fa?code=${encodeURIComponent(code.trim())}`),
    onSuccess: () => {
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['2fa'] });
      toast.info('2FA выключена');
    },
    onError: (err: Error) => toast.error('Код не принят', err.message),
  });

  const trust = useMutation({
    mutationFn: (input: { id: string; trusted: boolean }) => api.patch('/api/devices', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/api/devices?id=${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Устройство отключено');
    },
  });

  const enabled = state.data?.enabled ?? false;

  return (
    <SettingsCard title="Безопасность" description="Вход и устройства" icon={<ShieldCheck className="h-4 w-4" />}>
      <Row
        label="Двухфакторная аутентификация"
        hint={enabled ? 'Включена — код из приложения нужен при входе' : 'TOTP: Google Authenticator, 1Password, Aegis'}
      >
        {enabled ? (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500">
            Активна
          </span>
        ) : secret ? null : (
          <Button onClick={() => start.mutate()} loading={start.isPending}>
            Настроить
          </Button>
        )}
      </Row>

      {secret && !enabled ? (
        <div className="space-y-2 rounded-2xl bg-glass/50 p-3">
          <p className="text-xs text-ink-faint">
            Добавьте ключ в приложение — вручную или по ссылке <code className="font-mono">otpauth://</code>, затем
            введите шестизначный код.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-glass px-3 py-2 font-mono text-xs text-ink">
              {secret.secret}
            </code>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Скопировать ключ"
              onClick={() => {
                void navigator.clipboard.writeText(secret.secret);
                toast.success('Ключ скопирован');
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <a
            href={secret.otpauthUrl}
            className="block truncate text-xs text-accent-from underline decoration-dotted"
            title={secret.otpauthUrl}
          >
            Открыть в приложении-аутентификаторе
          </a>
          <div className="flex items-end gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              label="Код из приложения"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
            />
            <Button onClick={() => confirm.mutate()} loading={confirm.isPending} disabled={code.trim().length < 6}>
              Подтвердить
            </Button>
          </div>
        </div>
      ) : null}

      {enabled ? (
        <div className="flex items-end gap-2 rounded-2xl bg-glass/50 p-3">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            label="Код для отключения"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
          />
          <Button
            variant="danger"
            onClick={() => disable.mutate()}
            loading={disable.isPending}
            disabled={code.trim().length < 6}
          >
            Отключить 2FA
          </Button>
        </div>
      ) : null}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Laptop className="h-4 w-4" /> Устройства
        </p>
        {devices.isLoading ? (
          <p className="text-xs text-ink-faint">Загрузка…</p>
        ) : devices.data?.devices.length ? (
          <ul className="space-y-1.5">
            {devices.data.devices.map((device) => (
              <li key={device.id} className="rounded-2xl bg-glass/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{device.label}</p>
                    <p className="text-xs text-ink-faint">
                      {when(device.lastActiveAt)}
                      {device.ip ? ` · ${device.ip}` : ''}
                      {device.pushEnabled ? ' · push' : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Отключить устройство"
                    onClick={() => revoke.mutate(device.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Switch
                  checked={device.trusted}
                  onChange={(trusted) => trust.mutate({ id: device.id, trusted })}
                  label="Доверенное"
                  description="Без запроса кода 2FA"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-faint">Пока только текущая сессия.</p>
        )}
      </div>
    </SettingsCard>
  );
}
