// Offline support: keep the app shell + CDN libraries cached so the itinerary still opens
// with no signal (subway, mountain temples). Trip data itself comes from localStorage.
const CACHE = 'kansai-trip-v1';

// third-party hosts whose files never change for a given URL (versioned libs, fonts)
const STATIC_HOSTS = [
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'www.gstatic.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'static.line-scdn.net',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(['./', 'index.html', 'manifest.json', 'assets/banner.jpg', 'assets/icon-192.png']))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // the page itself: always try the network first so new versions show up, fall back to cache offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('index.html', res.clone())); return res; })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // the exchange-rate feed lives on jsdelivr too but changes daily — leave it to the network
  if (url.pathname.includes('currency-api')) return;

  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin && !STATIC_HOSTS.includes(url.hostname)) return;

  // stale-while-revalidate: answer from cache instantly, refresh it in the background
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
