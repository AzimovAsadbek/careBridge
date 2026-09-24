/* CareBridge service worker — caches the app shell so nurses can work offline.
 * API data is NOT cached here; the app keeps it in IndexedDB. */
const VERSION = 'cb-v2';
const PRECACHE = ['/', '/login', '/nurse', '/nurse/visit', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') (await caches.open(VERSION)).put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

/**
 * Page navigations are cached under one key per path (query string dropped), so the newest
 * HTML always replaces older copies — an offline user never boots a stale build.
 * Static pages read ids from the query string, so one cached shell serves every visit.
 */
async function navigation(request) {
  const url = new URL(request.url);
  const key = url.origin + url.pathname;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') (await caches.open(VERSION)).put(key, response.clone());
    return response;
  } catch {
    return (await caches.match(key)) || (await caches.match(url.origin + '/nurse')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return; // never touch API calls
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg') {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});
