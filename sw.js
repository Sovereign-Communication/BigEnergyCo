// BigEnergyCo service worker.
// Strategy:
//   - App shell (HTML): network-first with cache fallback — users always get
//     the freshest page when online, and the tool still opens offline.
//   - Assets (js/css/icons/manifest): stale-while-revalidate — instant loads,
//     quietly refreshed in the background.
//   - Never intercept cross-origin requests (NASA POWER, Groq worker).
// The sizing engine runs entirely client-side and NASA weather is cached in
// localStorage per site, so after one visit a location keeps working fully
// offline. Bump CACHE_VERSION to force every client to refresh on next visit.

const CACHE_VERSION = "beco-v80";
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
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
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

  if (req.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    // Network-first for the page itself.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("./index.html")),
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
      caches.match(req).then((hit) => {
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      }),
    );
  }
});
