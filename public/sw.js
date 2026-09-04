/* eslint-disable no-restricted-globals */
/**
 * Lumina service worker.
 *
 * Three jobs, in order of importance:
 *   1. Web Push — show notifications sent by the socket server and route clicks
 *      back into the right chat.
 *   2. Offline shell — if the network is gone, navigations land on /offline
 *      instead of the browser's dinosaur.
 *   3. Cheap caching for immutable build assets and uploaded media.
 *
 * Deliberately hand-written (no Workbox): the whole file is under 200 lines and
 * the caching rules here are simple enough that a generator would only obscure
 * them.
 */

const VERSION = 'v1';
const SHELL_CACHE = `lumina-shell-${VERSION}`;
const ASSET_CACHE = `lumina-assets-${VERSION}`;
const MEDIA_CACHE = `lumina-media-${VERSION}`;
const OFFLINE_URL = '/offline';

const SHELL = [OFFLINE_URL, '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One bad URL must not abort the whole install, so add them individually.
      await Promise.all(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting' || event.data?.type === 'skip-waiting') self.skipWaiting();
});

/** Cache-first with a background refresh — right for hashed build output. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type !== 'opaque') cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Auth callbacks, the socket handshake and every API route must stay live.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(OFFLINE_URL)) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/sounds/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => fetch(request)));
    return;
  }

  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/_next/image')) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE).catch(() => fetch(request)));
  }
});

// ── Web Push ────────────────────────────────────────────────────────────────
// Payload comes from server/push.js: { title, body, chatId, tag }.

function parsePayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return { body: event.data ? event.data.text() : '' };
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePayload(event);
  const chatId = payload.chatId || null;
  const url = payload.url || (chatId ? `/app/chat/${chatId}` : '/app');

  event.waitUntil(
    (async () => {
      // A focused tab already renders the toast — a second OS banner is noise.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (clients.some((client) => client.visibilityState === 'visible' && client.focused)) {
        clients.forEach((client) => client.postMessage({ type: 'push', payload }));
        return;
      }

      await self.registration.showNotification(payload.title || 'Lumina', {
        body: payload.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: payload.tag || chatId || 'lumina',
        renotify: true,
        // HIGH importance skips the "silent grouping" browsers apply to repeats.
        requireInteraction: payload.importance === 'HIGH',
        timestamp: Date.now(),
        data: { url, chatId },
        actions: chatId ? [{ action: 'open', title: 'Открыть' }, { action: 'mute', title: 'Не беспокоить' }] : [],
      });

      if (self.navigator.setAppBadge) {
        const existing = await self.registration.getNotifications();
        self.navigator.setAppBadge(existing.length).catch(() => {});
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  const { url = '/app', chatId } = event.notification.data || {};
  event.notification.close();

  if (event.action === 'mute') {
    // Fire-and-forget; the tab may not even be open to react.
    event.waitUntil(
      fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ muteForMinutes: 480 }),
      }).catch(() => {}),
    );
    return;
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const target = new URL(url, self.location.origin).href;
      for (const client of clients) {
        if (!client.url.startsWith(self.location.origin)) continue;
        await client.focus();
        if (client.url !== target && 'navigate' in client) await client.navigate(target).catch(() => {});
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener('notificationclose', () => {
  if (self.navigator.clearAppBadge) {
    self.registration.getNotifications().then((list) => {
      if (list.length === 0) self.navigator.clearAppBadge().catch(() => {});
    });
  }
});

/**
 * The push subscription can be rotated by the browser at any time; re-register
 * so the server keeps a live endpoint.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
      if (!applicationServerKey) return;
      const fresh = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const json = fresh.toJSON();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      }).catch(() => {});
    })(),
  );
});
