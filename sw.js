const CACHE_NAME = "fahri-assistant-v1";

const APP_FILES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_FILES);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan pernah menyimpan respons API, chat, gambar, atau data pengguna.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.match(request).then(cached => {
      return (
        cached ||
        fetch(request).then(response => {
          if (
            response.ok &&
            url.origin === location.origin
          ) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, copy);
            });
          }

          return response;
        })
      );
    })
  );
});