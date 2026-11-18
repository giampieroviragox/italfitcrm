// Minimal service worker: it exists so the app installs cleanly and shows a
// readable page when the phone is offline. It never stores CRM pages, API
// responses or anything tied to a signed-in person: only /offline.html.
const OFFLINE = "/offline.html";
const CACHE = "italfit-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only page navigations that fail get the offline page; everything else
  // (API, scripts, data) goes straight to the network untouched.
  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(() =>
      caches
        .match(OFFLINE)
        .then((page) => page || new Response("Offline", { status: 503 })),
    ),
  );
});
