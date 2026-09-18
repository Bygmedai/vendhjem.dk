// Service worker for /internt/registrering — genskabt S595 (17.09.2026).
// Formål: værktøjet skal åbne i en kold lade uden net. Cache-først for
// siden selv, stilarket og de to skrifter. Alt andet går til nettet som
// før. Cache-navnet skiftes, når siden ændrer sig; gamle caches slettes.
var CACHE = "vh-registrering-s595-1";
var FILER = ["/internt/registrering", "/assets/vh.css", "/assets/fonts/lora-var.woff2", "/assets/fonts/jetbrains-mono-400.woff2"];

self.addEventListener("install", function (e) {
  // Én fil ad gangen, ikke addAll: mangler én (fx en skrift), skal værktøjet
  // stadig kunne installeres og åbne uden net.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILER.map(function (f) { return c.add(f).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  var sti = url.pathname.replace(/\/$/, "");
  if (FILER.indexOf(sti) === -1 && FILER.indexOf(url.pathname) === -1) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(e.request).then(function (r) {
        if (r && r.ok && r.type === "basic") { var kopi = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, kopi); }); }
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
