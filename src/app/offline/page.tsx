'use client';

import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Served by the service worker when a navigation fails. Must not depend on any
 * data — it is rendered precisely when the network is unavailable.
 */
export default function OfflinePage() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent-gradient text-white shadow-glow-lg">
          {online ? <Wifi className="h-7 w-7" aria-hidden /> : <CloudOff className="h-7 w-7" aria-hidden />}
        </div>
        <h1 className="mt-5 text-2xl font-extrabold text-ink">
          {online ? 'Связь вернулась' : 'Нет подключения'}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {online
            ? 'Сеть снова доступна — можно продолжить с того же места.'
            : 'Lumina не смогла загрузить страницу. Отправленные ранее сообщения уже сохранены и уйдут, как только интернет появится.'}
        </p>
        <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Попробовать снова
        </Button>
        <p className="mt-4 text-xs text-ink-faint">
          {online ? 'Готово к загрузке' : 'Ожидание сети…'}
        </p>
      </div>
    </main>
  );
}
