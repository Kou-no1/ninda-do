// Change the release when any shipped resource changes. An entire release installs or none does.
const RELEASE = "1.16.0";
const scope = new URL(self.registration.scope);
const prefix = "ninda-do:shell:" + encodeURIComponent(scope.pathname) + ":";
const cacheName = prefix + RELEASE;
const assets = [
  "index.html", "poster.html", "style.css", "dojo-design.css", "favicon.svg", "manifest.webmanifest",
  "icons/ninda-192.png", "icons/ninda-512.png", "icons/ninda-180.png",
  ...["finger", "romaji", "jutsu", "nickname", "curriculum", "rank", "learning", "game", "garden", "literature"]
    .map(name => "data/" + name + "-data.js"),
  ...["nyumon-words", ...Array.from({length: 10}, (_, i) => "kyu" + (i + 1) + "-words"), "dan-words", "dan-sentences",
    "michi-genin", "michi-chunin", "michi-jonin", "michi-tokujonin", "michi-kage"].map(name => "data/words/" + name + ".js"),
  ...["svg-icons", "village-art", "save-manager", "audio-manager", "input-engine", "metrics-engine", "guide-renderer",
    "training-manager", "exam-manager", "achievement-manager", "collection-renderer", "literature-manager",
    "learning-manager", "courier-lantern", "ninja-game-manager", "garden-renderer", "main", "pwa"].map(name => "js/" + name + ".js")
].map(file => new URL(file, scope).href);
const known = new Set(assets);
const shellRequest = url => new Request(url, {cache: "reload", credentials: "same-origin", redirect: "error"});

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets.map(shellRequest))));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  // Only known public files are served. Query strings on launch/print links are not cache keys.
  let key = url.origin + url.pathname;
  if (request.mode === "navigate" && key === scope.href) key = new URL("index.html", scope).href;
  if (!known.has(key) || (url.search && request.mode !== "navigate")) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(key);
    if (hit) return hit;
    // Repair a missing public file online without caching an arbitrary incoming request.
    await cache.add(shellRequest(key));
    return (await cache.match(key)) || Response.error();
  })());
});
