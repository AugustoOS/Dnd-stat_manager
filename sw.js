const CACHE = "dnd-stat-manager-v3";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png",
  "./js/importers.js", "./js/core.js", "./js/views.js", "./js/actions.js",
  "./data/srd-monsters.js", "./data/srd-spells.js", "./data/srd-items.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Responde do cache na hora (funciona offline) e atualiza o cache em segundo plano. */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request, { ignoreSearch: true }).then((hit) => {
        const net = fetch(e.request).then((res) => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
