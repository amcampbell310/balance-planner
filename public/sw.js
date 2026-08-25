// Minimal service worker: enables PWA installability and a navigation
// fallback when fully offline. Deliberately does NOT cache API responses or
// page data — this is a live planning app tied to a per-user session, and
// serving stale or wrong-session data from a cache would be a real
// correctness bug, not a convenience. The only thing ever cached is the
// static, session-independent offline fallback page itself.

const CACHE_NAME = "balance-planner-shell-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// Network-first for page navigations, falling back to the cached offline
// page only when the network request itself fails outright — a real 4xx/5xx
// server response is not "offline" and is left alone. Every other request
// (static assets, API calls) passes straight through untouched.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
