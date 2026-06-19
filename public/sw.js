// This service worker will immediately unregister itself when activated.
const CACHE_NAME = 'meal-planner-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/next.svg',
  '/login',
  '/dashboard',
  '/dishes',
  '/search',
  '/plan',
  '/inventory',
];

self.addEventListener('install', event => {
  // skip waiting so activate runs immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
});

self.addEventListener('activate', event => {
  // clear caches and unregister this service worker to avoid serving stale assets
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {}
      // unregister this worker
      const reg = await self.registration.unregister();
      // if unregister succeeded, claim clients so they reload without SW
      if (reg) {
        try { await self.clients.claim(); } catch (e) {}
      }
    })()
  );
});

// Fallback fetch handler — try network first, then cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
