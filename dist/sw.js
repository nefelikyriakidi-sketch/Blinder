const cachePrefix = `blinder-shell:${self.registration.scope}:`;
const cacheName = `${cachePrefix}v3`;
const home = new URL("./", self.registration.scope).href;
const index = new URL("./index.html", home).href;
const shell = [
  home,
  new URL("./styles.css", home).href,
  new URL("./app.js", home).href,
  new URL("./round.js", home).href,
  new URL("./venues.js", home).href,
  new URL("./venue-photos.jpg", home).href,
  new URL("./manifest.webmanifest", home).href,
  new URL("./icon-192.png", home).href,
  new URL("./icon-512.png", home).href,
  new URL("./apple-touch-icon.png", home).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(cacheName)
      .then((cache) => cache.addAll(shell.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const previousVersions = names.filter(
      (name) => name.startsWith(cachePrefix) && name !== cacheName,
    );
    await Promise.all(previousVersions.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  url.search = "";
  const appHome = request.mode === "navigate" && (url.href === home || url.href === index);
  if (!appHome && !shell.includes(request.url)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(appHome ? home : request)) ?? fetch(request);
  })());
});
