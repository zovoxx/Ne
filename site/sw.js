/* Lanternfall service worker. Generated at build time from src/platform/sw-template.js */
const VERSION = 'f1b47981c0d5';
const CACHE = 'lanternfall-' + VERSION;
const PRECACHE = ["./","./assets/CanvasPool-DSFMGSx5.js","./assets/RenderTargetSystem-DgrPN-N5.js","./assets/browserAll-zOzG6d9Y.js","./assets/canvasUtils-BGusn-Eh.js","./assets/getTexelRangeRects-DRoSGPnx.js","./assets/getTextureBatchBindGroup-8nn_p1gP.js","./assets/index-84or9fab.js","./assets/index-CqVUC5mX.css","./assets/init-D30FVSf6.js","./assets/webworkerAll-CP1Y2eNA.js","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-512.png","./index.html","./manifest.webmanifest"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lanternfall-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Navigations: network first so new deploys show up, cache fallback for offline play.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreVary: true, ignoreSearch: true }).then((r) => r || caches.match('./index.html', { ignoreVary: true }))),
    );
    return;
  }
  // Everything else: cache first (hashed assets are immutable).
  event.respondWith(
    // ignoreVary: module scripts send an Origin header that precache requests didn't
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
