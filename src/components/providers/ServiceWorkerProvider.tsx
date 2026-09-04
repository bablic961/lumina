'use client';

import { useEffect } from 'react';
import { toast } from '@/store/toast';

/**
 * Registers `/public/sw.js` once per load and listens for the two messages it
 * can send back. Deliberately silent about failures: an unavailable service
 * worker (private window, http on a LAN IP, older Safari) must not surface as
 * an error — the app works fine without offline support.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (cancelled) return;

        // A worker waiting to activate means a new build is live; take it right
        // away rather than after every tab closes.
        const promote = () => registration.waiting?.postMessage('skip-waiting');
        if (registration.waiting) promote();
        registration.addEventListener('updatefound', () => {
          registration.installing?.addEventListener('statechange', (event) => {
            if ((event.target as ServiceWorker).state === 'installed') promote();
          });
        });
      } catch {
        /* Offline support is optional; nothing to report. */
      }
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; payload?: { title?: string; body?: string } } | null;
      if (data?.type === 'push' && data.payload?.title) {
        toast.info(data.payload.title, data.payload.body);
      }
    };

    void register();
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  return null;
}
