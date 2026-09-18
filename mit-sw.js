// Service worker for /mit — appen på hjemmeskærmen.
//
// Scope er /mit, og filen ligger derfor i roden: en service worker kan kun
// styre stier under sin egen mappe, så en fil i /assets/ kunne ikke tage /mit.
//
// HVAD DEN CACHER, OG HVAD DEN IKKE GØR
//
// Den cacher skallen: stilarket, skrifterne, ikonerne og én offline-side.
// Den cacher ALDRIG en /mit-side, for de er personlige — en telefon, der
// skifter hænder, skal ikke kunne vise en anden persons aftale fra i går.
// Uden net får man offline-siden, hvor man stadig kan skrive en dag ned;
// linjen lægges i telefonens kø og sendes, når nettet er der igen.
//
// Det er det ærlige bytte: appen åbner altid, men den lyver aldrig om, hvad
// der står i databasen lige nu.

var CACHE = "vh-mit-1";
var OFFLINE = "/mit-offline";   // uden .html: assets serverer HTML uden endelse (html_handling)
var FILER = [
  OFFLINE,
  "/assets/vh.css",
  "/assets/fonts/lora-var.woff2",
  "/assets/fonts/jetbrains-mono-400.woff2",
  "/assets/favicon.svg",
  "/assets/app-192.png",
];

self.addEventListener("install", function (e) {
  // Én ad gangen, ikke addAll: mangler en enkelt fil, skal appen stadig
  // kunne installeres.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILER.map(function (f) { return c.add(f).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigation til /mit: altid nettet først. Falder det ud, offline-siden.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(function () {
      return caches.match(OFFLINE, { ignoreSearch: true });
    }));
    return;
  }

  // Skallen: cache først, og hent stille en frisk kopi til næste gang.
  if (FILER.indexOf(url.pathname) !== -1) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && r.ok && r.type === "basic") {
          var kopi = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, kopi); });
        }
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    }));
  }
});
