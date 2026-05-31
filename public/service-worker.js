const CACHE_NAME = 'realpro-cache-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/index.js',
  '/proposal.html',
  '/client-portal',
  '/client-portal.html',
  '/manifest.json',
  '/uploads/logo_192.png',
  '/uploads/logo_512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css'
];

// Install Event: cache static shell assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Pre-caching static app shell...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event: clear old cache blocks
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: handle offline list fallbacks
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 1. Network-first strategy for live properties listings
  if (requestUrl.pathname === '/api/properties') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Open cache and save the fresh properties payload
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => {
          // Network failed (offline), try fetching from local cache fallback
          console.log('[Service Worker] Offline detected. Serving cached properties list.');
          return caches.match(event.request);
        })
    );
    return;
  }

  // 2. Network-First strategy for static assets & pages to optimize speeds and ensure immediate hot-reload updates
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache newly fetched external resources on the fly (e.g. dynamic upload maps)
        if (response.status === 200 && event.request.method === 'GET' && !requestUrl.pathname.startsWith('/api/')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline / Network Failure: Fallback to cache match
        console.log('[Service Worker] Serving cached offline asset for:', requestUrl.pathname);
        return caches.match(event.request);
      })
  );
});
