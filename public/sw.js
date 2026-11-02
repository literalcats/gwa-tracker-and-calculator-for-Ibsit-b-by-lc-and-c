/*
  sw.js -- the service worker: what makes the app work with NO internet.
  A service worker is a small script the browser runs in the background.

  1. On the first visit it saves ("caches") the app's files on the device.
  2. After that, if the network is down, it serves those saved files instead.

  Strategy: "network first, cache as backup".
    - Online  -> always get the newest file (so a new deploy shows up right away) and refresh the saved copy.
    - Offline -> use the saved copy.

  IMPORTANT when you ADD a new file to the app: add it to CORE below so it is saved at install time.
  (Files not listed are still saved the first time they are loaded, but listing them is safer.)
*/
const CACHE = "ibsit-b-gwa-v1";        // change the number if you ever need to force-clear old saved files

const CORE = [
  "./", "index.html", "manifest.webmanifest",
  "css/theme.css", "css/base.css", "css/components.css",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png",
  "js/theme-init.js", "js/app.js", "js/config.js",
  "js/models/schema.js", "js/models/presets.js",
  "js/services/db.js", "js/services/store.js", "js/services/calc.js",
  "js/services/backup.js", "js/services/excel.js", "js/services/excel-sheets.js",
  "js/ui/dom.js", "js/ui/format.js", "js/ui/icons.js", "js/ui/limits.js", "js/ui/modal.js", "js/ui/toast.js",
  "js/views/dashboard.js", "js/views/course.js", "js/views/what-if-card.js", "js/views/components-card.js",
  "js/views/course-form.js", "js/views/settings.js",
];

// The Excel library is optional at install time: if the file isn't there yet, installing must not fail.
const OPTIONAL = ["vendor/xlsx.full.min.js"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.all(OPTIONAL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/** Try the network for up to `ms` milliseconds. */
function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    fetch(request).then((r) => { clearTimeout(timer); resolve(r); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetchWithTimeout(request, 4000);
      if (response.ok) cache.put(request, response.clone());      // keep the saved copy fresh
      return response;
    } catch {
      const saved = await cache.match(request, { ignoreSearch: true });
      if (saved) return saved;
      if (request.mode === "navigate") return (await cache.match("index.html")) || Response.error();
      return Response.error();
    }
  })());
});
