/* Mountain Car Garage — service worker
   Minimal offline shell so the site is installable as a PWA.
   Strategy: cache-first for the app shell, network-first for navigations. */
const CACHE = 'mcg-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo.jpg',
  './logo-white.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Best-effort: don't fail the install if one asset is missing.
      return Promise.allSettled(SHELL.map(function (url) { return cache.add(url); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  // Network-first for page navigations, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        // Cache'ujemy tylko realnie poprawna odpowiedz z naszego originu —
        // inaczej strona bledu zwrocona z kodem 200 wyladowalaby w cache jako shell.
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          event.waitUntil(caches.open(CACHE).then(function (c) { return c.put('./index.html', copy); }));
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // Stale-while-revalidate dla statykow z tego samego originu.
  // NIE cache-first: przy cache-first podmiana pliku w miejscu (np. nowe hero3.webp
  // pod ta sama nazwa) nigdy nie dotarlaby do uzytkownika z zainstalowanym SW,
  // dopoki recznie nie zmienimy nazwy CACHE. Tutaj: cache leci natychmiast,
  // a w tle pobieramy swieza wersje i nadpisujemy — poprawka widoczna przy kolejnej wizycie.
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          event.waitUntil(caches.open(CACHE).then(function (c) { return c.put(req, copy); }));
        }
        return res;
      }).catch(function () { return cached; });
      if (cached) event.waitUntil(network);   // rewalidacja przezyje zamkniecie strony
      return cached || network;
    })
  );
});
