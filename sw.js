const CACHE = 'tgcc-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only cache same-origin GET requests
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first for HTML (always get fresh shell). GitHub Pages serves deep links
  // (e.g. /library) via 404.html with an HTTP 404 status but a valid app shell body —
  // that's expected and must not be treated as a failure or cached as an error page.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Clone immediately — if we wait until inside the caches.open().then(), the
          // browser may have already started reading the body we're about to return,
          // and clone() throws once the body stream has been disturbed.
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(new URL('index.html', self.registration.scope)))
    );
    return;
  }

  // Cache-first for JS/CSS/fonts/images
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      });
    })
  );
});
