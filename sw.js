'use strict';
// Planner SEA · service worker: la «carcasa» de la app funciona sin conexión; los datos (Supabase) siempre van a la red
const CACHE = 'psea-v1';
const SHELL = ['./', 'index.html', 'app.css', 'apple.css', 'manifest.webmanifest', 'favicon.png', 'logo.png', 'icons/icon-192.png', 'icons/apple-touch-icon.png', 'js/core.js','js/layout.js','js/views.js','js/actions.js','js/extras.js','js/tools.js','js/more.js','js/docs.js','js/work.js','js/calc-core.js','js/calc-view.js','js/fx.js','js/main.js'];
const CDN = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    // red primero: con conexión siempre llega la última versión publicada; sin ella, la copia guardada
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; })
      .catch(() => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
  } else if (CDN.includes(url.hostname)) {
    // librerías y fuentes con versión fija: caché primero
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(n => { const copy = n.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return n; })));
  }
  // el resto (Supabase, Google…) no se toca: siempre en directo
});
