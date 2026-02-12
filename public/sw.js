// RangerWatch Service Worker
// Strategy: cache-first for shell/static assets; network-only for API

const CACHE_VERSION = 'rw-v1';
const SHELL_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon.svg',
];

// ── Install: pre-cache shell ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(SHELL_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache failed:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clear old caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always use network for API calls and cross-origin resources
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname !== self.location.hostname
  ) {
    return; // Let browser handle it directly
  }

  // For same-origin GET requests: try cache first, fall back to network
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            // Cache JS/CSS/images/fonts; skip HTML pages (they must be fresh)
            const ct = response.headers.get('content-type') ?? '';
            const shouldCache =
              ct.includes('javascript') ||
              ct.includes('css') ||
              ct.includes('image') ||
              ct.includes('font') ||
              url.pathname.endsWith('.svg') ||
              url.pathname.endsWith('.png');

            if (shouldCache) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
          }
          return response;
        })
        .catch(() => {
          // Return a minimal offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/').then((r) => r ?? new Response('Offline', { status: 503 }));
          }
          return new Response('', { status: 503 });
        });
    })
  );
});
