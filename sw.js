/* ══════════════════════════════════════════
   PeedPadPark — Service Worker  v1.0
   ══════════════════════════════════════════ */

const CACHE_NAME = 'peedpadpark-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap'
];

/* ── Install: cache static assets ── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.map(url => {
        return new Request(url, { cache: 'reload' });
      })).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: Network-first for Firebase, Cache-first for static ── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* Always go network for Firebase & googleapis auth */
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('firebase') ||
    event.request.method !== 'GET'
  ) {
    return; /* pass through — no cache */
  }

  /* Fonts — cache-first */
  if (url.hostname.includes('fonts.g') || url.hostname.includes('gstatic')) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  /* App shell — cache-first, fallback to network */
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          if (!res || res.status !== 200 || res.type === 'opaque') return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => {
          /* Offline fallback for HTML navigation */
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

/* ── Background Sync (optional future use) ── */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});

/* ── Push Notifications (optional future use) ── */
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PeedPadPark';
  const options = {
    body: data.body || 'มีการแจ้งเตือนใหม่',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.url || './'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
