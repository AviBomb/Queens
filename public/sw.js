const CACHE_NAME = 'queens-game-v6';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function saveCopy(request, response) {
  if (!response || response.status !== 200) return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // The in-app update check asks for no-store; let it reach the network untouched.
  if (request.method !== 'GET' || request.cache === 'no-store') return;

  // The page itself goes to the network first so a new deploy loads straight away.
  // The cached copy is only the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((response) => {
          saveCopy(request, response);
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('./'))
            .then((cached) => cached || caches.match('index.html'))
        )
    );
    return;
  }

  // Scripts, styles and images have hashed or stable names: serve the cached copy, refresh it in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          saveCopy(request, response);
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
