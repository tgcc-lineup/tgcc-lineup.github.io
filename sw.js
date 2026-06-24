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

  // Only handle same-origin GET requests
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Don't intervene in page navigation at all. GitHub Pages already serves the right
  // app shell for every path (including deep links, via its 404.html fallback) without
  // our help, and any custom navigate-handling logic here risks resolving to `undefined`
  // on edge cases (e.g. fetch fails AND nothing is cached yet), which the browser then
  // shows as a hard "failed to fetch" page instead of the real one.
  if (e.request.mode === 'navigate') return;

  // Cache-first for static assets (JS bundle, fonts, images) — these are immutable
  // content-hashed files, so serving a cached copy is always safe and makes tab-discard
  // reloads instant. One retry on a transient fetch failure before giving up, so a brief
  // network hiccup right when a backgrounded tab wakes up doesn't break the whole page.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      const tryFetch = () => fetch(e.request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      });
      return tryFetch().catch(() => tryFetch());
    })
  );
});
