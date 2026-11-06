const CACHE_NAME = 'mensageiro-pwa-v2';
const ASSETS_TO_CACHE = [
  '/mensageiro/',
  '/mensageiro/index.html',
  '/mensageiro/manifest.webmanifest',
  '/mensageiro/icon-512.svg',
  '/mensageiro/favicon.ico',
];

// Install: Cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('mensageiro-pwa-')) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network First for API, Cache First for Static Assets, Fallback to index.html for navigation
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignora requisições de API (Evolution e Antigravity) para sempre ir na rede
  if (url.pathname.includes('/api/')) {
    return;
  }

  // Apenas lida com o escopo /mensageiro/
  if (!url.pathname.startsWith('/mensageiro')) {
    return;
  }

  // Navegação HTML: Network-first com fallback para index.html em cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/mensageiro/index.html');
      })
    );
    return;
  }

  // Assets estáticos (JS, CSS, Imagens, Fontes): Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
