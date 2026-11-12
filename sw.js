// Service worker de Semilla Dorada: permite abrir la app sin conexión.
//
// IMPORTANTE: la lista ASSETS y VERSION se generan con:  node herramientas/actualizar-sw.js
// Ejecútalo cada vez que cambies, agregues o borres un archivo de la app y antes de publicar.
// (La VERSION cambia sola porque es un hash del contenido de los archivos.)
//
// Los datos del usuario viven en IndexedDB, NO en esta caché: borrar cachés viejas es seguro.
const CACHE_PREFIX = "semilla-dorada-logistics-";
// VERSION-START
const VERSION = "v4b8f36d951";
// VERSION-END
const CACHE = CACHE_PREFIX + VERSION;
// ASSETS-START
const ASSETS = [
  "./",
  "./assets/fonts/Inter-Bold.woff",
  "./assets/fonts/Inter-Medium.woff",
  "./assets/fonts/Inter-Regular.woff",
  "./assets/fonts/Inter-SemiBold.woff",
  "./assets/fonts/RobotoCondensed-Bold.woff",
  "./assets/fonts/RobotoCondensed-Medium.woff",
  "./assets/fonts/RobotoCondensed-Regular.woff",
  "./css/forms.css",
  "./css/layout.css",
  "./css/logistics-control.css",
  "./css/styles.css",
  "./css/ticket-letter.css",
  "./css/ticket-thermal.css",
  "./css/ticket.css",
  "./database/001_stores.sql",
  "./images/icon-maskable-192.png",
  "./images/icon-maskable-512.png",
  "./images/logo-semilla-dorada.png",
  "./index.html",
  "./js/app-commission.js",
  "./js/app-core.js",
  "./js/app-export.js",
  "./js/app-history.js",
  "./js/app-sales.js",
  "./js/app-scanner.js",
  "./js/app-settings.js",
  "./js/app-stores.js",
  "./js/auth.js",
  "./js/backup.js",
  "./js/icons.js",
  "./js/loader.js",
  "./js/navigation.js",
  "./js/pwa.js",
  "./js/qr.js",
  "./js/storage.js",
  "./js/utils.js",
  "./manifest.json",
  "./screens/cash-sales.html",
  "./screens/commission.html",
  "./screens/entries.html",
  "./screens/entry-history.html",
  "./screens/history.html",
  "./screens/home.html",
  "./screens/prices.html",
  "./screens/sales-archives.html",
  "./screens/sales.html",
  "./screens/stores.html",
  "./users-config.js"
];
// ASSETS-END

self.addEventListener("install", event => {
  // "reload" evita copiar archivos viejos desde la caché HTTP del navegador.
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: "reload" }))))
  );
  // No hay skipWaiting automático: la versión nueva espera a que el usuario pulse "Actualizar"
  // (así nunca se mezclan archivos de dos versiones en una captura en curso).
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response && response.ok) cache.put(event.request, response.clone());
      return response;
    } catch {
      if (event.request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      return new Response("Recurso no disponible sin conexión.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
