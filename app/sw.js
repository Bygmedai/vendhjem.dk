/* Vend Hjem · feltregistrering — cache så siden virker uden signal på øen. */
var CACHE = 'vh-reg-v1';
var FILER = [
  'registrering',
  'registrering.js',
  '../assets/vh.css',
  '../assets/fonts/lora-var.woff2',
  '../assets/fonts/jetbrains-mono-400.woff2',
  '../assets/fonts/jetbrains-mono-500.woff2',
  '../assets/favicon.svg'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILER.map(function (f) { return c.add(f).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (x) { return x !== CACHE; }).map(function (x) { return caches.delete(x); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      if (r && r.ok) { var c = r.clone(); caches.open(CACHE).then(function (cc) { cc.put(e.request, c); }); }
      return r;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});
