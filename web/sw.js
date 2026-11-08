/* Sonrisas · service worker.
   Permite instalar la app y que abra aunque la conexión falle.
   Con internet siempre carga la versión más nueva; los datos (Supabase) nunca se guardan aquí. */
const VERSION = 'sonrisas-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/styles.css',
  'js/config.js', 'js/utils.js', 'js/pwa.js', 'js/data.js', 'js/account.js', 'js/odontogram.js', 'js/views.js', 'js/admin.js', 'js/app.js',
  'vendor/supabase-2.118.0.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const save = (request, response) => {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(VERSION).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Supabase, fuentes y enlaces externos van directo a internet.
  if (url.origin !== self.location.origin) return;

  // La librería tiene versión fija en el nombre: se sirve desde el teléfono.
  if (url.pathname.includes('/vendor/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => save(request, res))));
    return;
  }

  // Todo lo demás: primero internet (versión nueva); sin conexión, lo guardado.
  event.respondWith(
    fetch(request)
      .then((res) => save(request, res))
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
