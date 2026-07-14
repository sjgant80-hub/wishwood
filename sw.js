/* Wishwood service worker · cache-first offline shell · ◊·κ=1 */
/* Bump CACHE version whenever the shell changes to force reload */

const CACHE   = 'wishwood-v16-all-buttons';
const SHELL   = [
  './',
  './index.html',
  './hub.html',
  './book.html',
  './admin.html',
  './wa.html',
  './howitworks.html',
  './credentials.html',
  './sync-setup.html',
  './ai.html',
  './autopilot.html',
  './sim.html',
  './social.html',
  './media.html',
  './relaunch.html',
  './roost.html',
  './hubphone.html',
  './manifest.webmanifest',
  './ww-sync.js',
  './ww-nav.js',
  './ww-autopilot-status.js',
  './ai/adapter.js',
  './ai/agent.js',
  './ai/events.js',
  './ai/harvest.js',
  './ai/sim.js',
  './ai/social.js',
  './ai/research.js',
  './ai/tools.js',
  './ai/kernel.example.json',
  './ai/kernel.schema.json',
];

/* ─── install: pre-cache the shell ────────────────────────────── */
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL).catch(() => { /* tolerate missing files */ });
    self.skipWaiting();
  })());
});

/* ─── activate: purge older caches ────────────────────────────── */
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

/* ─── fetch: intercept + serve ────────────────────────────────── */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* NEVER cache · always network:
   *  · Worker API calls (bookings, messages, auth · state changes)
   *  · Google Fonts (already CDN-cached)
   *  · trystero signaling / BT tracker websocket calls
   *  · Cloudflare Worker generally
   */
  if (url.host.includes('workers.dev') ||
      url.host.includes('anthropic.com') ||
      url.host.includes('openai.com') ||
      url.host.includes('googleapis.com') ||
      url.host.includes('gstatic.com') ||
      url.host.includes('stripe.com') ||
      url.protocol === 'ws:' || url.protocol === 'wss:') {
    return; // fall through · browser does the request
  }

  /* Third-party JS from esm.run · cache-then-network */
  if (url.host === 'esm.run' || url.host === 'esm.sh' || url.host === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => caches.match(req)))
    );
    return;
  }

  /* Our origin · cache-first, fall back to network, fall back to offline index */
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => caches.match('./hub.html')))
    );
  }
});

/* ─── message: allow client to trigger update ────────────────── */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
