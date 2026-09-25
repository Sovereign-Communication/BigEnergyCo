// BigEnergyCo service worker.
// Strategy:
//   - App shell (HTML): network-first with cache fallback — users always get
//     the freshest page when online, and the tool still opens offline.
//   - Assets (js/css/icons/manifest): stale-while-revalidate — instant loads,
//     quietly refreshed in the background.
//   - Never intercept cross-origin requests (NASA POWER, Groq worker).
// The sizing engine runs entirely client-side and NASA weather is persisted
// per site (Cache Storage + IndexedDB, owned by nasa.js — never deleted
// here), so after one visit a location keeps working fully offline. Bump
// CACHE_VERSION to force every client to refresh on next visit.

const CACHE_VERSION = "beco-v85";

// Every cache operation races this budget; a slower one degrades to its
// fallback instead of hanging the request that waited on it.
const CACHE_OP_BUDGET_MS = 1500;
function cacheOp(promise, fallback = null) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise((ok) => setTimeout(() => ok(fallback), CACHE_OP_BUDGET_MS)),
  ]);
}
// Explicit file URLs only: cache.addAll rejects the whole batch if ANY entry
// 404s or redirects, and directory URLs ("./blog/") depend on server
// directory-index behavior. Every entry below must exist on disk — the
// asset-token --check enforces it.
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/site.css",
  "./blog/index.html",
  "./solar-calculator/index.html",
  "./about/index.html",
  "./solar-heatmap/index.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // Only caches matching our versioned prefix are ours. Unversioned
          // names like "beco-weather-v1" (the app's own NASA weather layer,
          // owned by nasa.js) and anything foreign must NEVER be deleted —
          // wiping the weather cache on every SW update forced a full
          // ~2 MB NASA re-fetch after each deploy (the reload 17s stall).
          keys
            .filter((k) => /^beco-v\d+$/.test(k) && k !== CACHE_VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch API / satellite data

  // Cache Storage queues behind the app's big concurrent writes (the ~2 MB
  // NASA weather cache), so cache I/O must never sit on a request's critical
  // path. Two rules enforce that:
  //   * every cache operation races a short timeout — a stalled lookup
  //     degrades to a network fetch, never a hung request (observed: a
  //     module load hanging 8s+ behind a weather write);
  //   * the response clone destined for the cache is drained into memory
  //     immediately, so the tee can never backpressure the page's own byte
  //     stream on a stalled cache write (the "reload 17s stall" class).
  const serveFresh = (res) => {
    if (!res || res.status !== 200) return res; // redirects/404/304 pass through
    const copy = res.clone();
    event.waitUntil(
      copy
        .arrayBuffer()
        .then((body) =>
          cacheOp(caches.open(CACHE_VERSION).then((c) => c.put(req, body))),
        )
        .catch(() => {}),
    );
    return res;
  };

  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    // Network-first for the page itself.
    event.respondWith(
      fetch(req)
        .then(serveFresh)
        .catch(() =>
          cacheOp(caches.match(req)).then(
            (hit) => hit || cacheOp(caches.match("./index.html")),
          ),
        ),
    );
    return;
  }

  if (
    url.pathname.includes("/assets/") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    // Stale-while-revalidate for assets.
    event.respondWith(
      cacheOp(caches.match(req)).then((hit) => {
        const refresh = fetch(req)
          .then(serveFresh)
          .catch(() => hit);
        return hit || refresh;
      }),
    );
  }
});
