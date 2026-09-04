'use client';

import { useEffect, useState } from 'react';
import { BellRing, Volume2 } from 'lucide-react';
import { api } from '@/lib/api';
import { playTone } from '@/lib/sound';
import { toast } from '@/store/toast';
import { useUi } from '@/store/ui';
import { Button } from '@/components/ui/Button';
import { Switch, Segmented } from '@/components/ui/Switch';
import { SettingsCard, Row } from './SettingsCard';

type Tone = 'chime' | 'drop' | 'pulse';

const TONES: { value: Tone; label: string }[] = [
  { value: 'chime', label: 'Перезвон' },
  { value: 'drop', label: 'Капля' },
  { value: 'pulse', label: 'Пульс' },
];

/** VAPID keys travel as base64url; `applicationServerKey` wants raw bytes. */
function urlBase64ToUint8Array(base64: string) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

/** Sound, tone and Web Push enrolment (service worker + VAPID). */
export function NotificationsSection() {
  const { soundEnabled, soundTone, set } = useUi();
  const [pushState, setPushState] = useState<'unknown' | 'unsupported' | 'off' | 'on' | 'denied'>('unknown');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setPushState('denied');
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushState(sub ? 'on' : 'off'))
      .catch(() => setPushState('off'));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState(permission === 'denied' ? 'denied' : 'off');
        toast.error('Разрешение не выдано', 'Включите уведомления для сайта в настройках браузера');
        return;
      }
      const { publicKey } = await api.get<{ publicKey: string | null }>('/api/push/subscribe');
      if (!publicKey) {
        toast.error('Push не настроен', 'На сервере нет VAPID-ключей — уведомления придут только во вкладке');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await api.post('/api/push/subscribe', {
        endpoint: json.endpoint,
        keys: json.keys,
        userAgent: navigator.userAgent,
      });
      setPushState('on');
      toast.success('Push-уведомления включены');
    } catch (err) {
      toast.error('Не удалось подписаться', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.del(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`);
        await sub.unsubscribe();
      }
      setPushState('off');
      toast.info('Push-уведомления выключены');
    } catch (err) {
      toast.error('Не удалось отписаться', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title="Уведомления" description="Звук и push на устройство" icon={<BellRing className="h-4 w-4" />}>
      <Switch
        checked={soundEnabled}
        onChange={(value) => set('soundEnabled', value)}
        label="Звук новых сообщений"
        description="Синтезируется в браузере — файлы не качаются"
      />

      <Row label="Тон">
        <div className="flex items-center gap-2">
          <Segmented
            value={soundTone}
            onChange={(value: Tone) => {
              set('soundTone', value);
              playTone(value);
            }}
            options={TONES}
          />
          <Button variant="ghost" size="icon" onClick={() => playTone(soundTone)} aria-label="Прослушать">
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
      </Row>

      <Row
        label="Push-уведомления"
        hint={
          pushState === 'unsupported'
            ? 'Браузер не поддерживает Web Push'
            : pushState === 'denied'
              ? 'Заблокировано в настройках браузера'
              : 'Приходят, даже когда вкладка закрыта'
        }
      >
        {pushState === 'on' ? (
          <Button variant="glass" onClick={disable} loading={busy}>
            Отключить
          </Button>
        ) : (
          <Button onClick={enable} loading={busy} disabled={pushState === 'unsupported' || pushState === 'denied'}>
            Включить
          </Button>
        )}
      </Row>

      <p className="text-xs text-ink-faint">
        Уведомления для отдельного чата отключаются в его меню — эта настройка глобальная.
      </p>
    </SettingsCard>
  );
}
