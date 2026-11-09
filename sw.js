/* Daily Dubai & Jebel Ali News — service worker
   Bump VERSION on every deploy that changes cached files. Old caches are removed on activate. */
const VERSION = 'v1.0.0';
const STATIC_CACHE = 'dj-static-' + VERSION;
const DATA_CACHE = 'dj-data-' + VERSION;
const DATA_MAX_ENTRIES = 40;

// Relative URLs resolve against this file's location, so they work under /dubaijebelalinews/
const PRECACHE = [
  './', './index.html', './offline.html', './manifest.webmanifest',
  './css/styles.css', './js/app.js',
  './favicon.svg', './favicon.ico', './apple-touch-icon.png', './og-image.png',
  './icons/icon-72.png', './icons/icon-96.png', './icons/icon-128.png', './icons/icon-144.png',
  './icons/icon-152.png', './icons/icon-192.png', './icons/icon-384.png', './icons/icon-512.png',
  './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
  './icons/favicon-16x16.png', './icons/favicon-32x32.png'
];

// Cross-origin data sources: Network-First with cache fallback
const DATA_HOSTS = ['api.rss2json.com', 'api.allorigins.win', 'www.reddit.com', 'api.open-meteo.com', 'news.google.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Add individually so one failed asset never blocks installation
    await Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = [STATIC_CACHE, DATA_CACHE];
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('dj-') && !keep.includes(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { event.respondWith(handleNavigate(req)); return; }
    if (url.pathname.indexOf('/tools/') !== -1) return; // dev tools: always go to network
    event.respondWith(cacheFirst(req));
    return;
  }
  if (DATA_HOSTS.indexOf(url.hostname) !== -1) event.respondWith(networkFirst(req));
});

async function handleNavigate(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    return (await caches.match(req, { ignoreSearch: true }))
      || (await caches.match('./index.html'))
      || (await caches.match('./offline.html'))
      || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const any = await caches.match(req, { ignoreSearch: true });
    if (any) return any;
    if (req.destination === 'document') return (await caches.match('./offline.html')) || Response.error();
    return Response.error();
  }
}

// Network-First. Cached copies are stamped when stored and flagged when served from cache,
// so the page can say "saved copy from 14:05" instead of pretending the data is live.
async function networkFirst(req) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) store(cache, req, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) {
      const h = new Headers(hit.headers);
      h.set('X-DJ-Cache', '1');
      return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers: h });
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function store(cache, req, res) {
  const h = new Headers(res.headers);
  h.set('X-DJ-Stored-At', String(Date.now()));
  await cache.put(req, new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: h }));
  await trim(cache);
}

async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.length - DATA_MAX_ENTRIES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}
