// Service Worker: hält die App offline verfügbar.
// Eigene Dateien: erst Netz (immer aktuell), bei fehlendem Netz aus dem Cache.
// Google Fonts und Firebase-SDK: aus dem Cache, sobald einmal geladen.
// Bei Änderungen an der Dateiliste VERSION erhöhen.

const VERSION = 'v4';
const CACHE = `paar-app-${VERSION}`;
const FONT_CACHE = 'paar-app-fonts';
const LIB_CACHE = 'paar-app-libs';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/data.js',
  './js/firebase.js',
  './js/firebase-config.js',
  './js/ui.js',
  './js/util.js',
  './js/views/auth.js',
  './js/views/common.js',
  './js/views/koppeln.js',
  './js/views/start.js',
  './js/views/kalender.js',
  './js/views/listen.js',
  './js/views/statistik.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' – frisch vom Server, nicht aus dem Browser-Cache
  const fresh = APP_SHELL.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(fresh)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![CACHE, FONT_CACHE, LIB_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }
  // Firebase-SDK: Adressen enthalten die Versionsnummer, ändern sich also nie
  if (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    event.respondWith(cacheFirst(request, LIB_CACHE));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    // no-cache: beim Server nachfragen statt bis zu 10 Min. alte Dateien aus dem Browser-Cache
    // zu nehmen (GitHub Pages erlaubt max-age=600). Unverändert kommt nur ein kurzes 304 zurück.
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('./index.html');
    throw new Error('Offline und nicht im Cache');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
