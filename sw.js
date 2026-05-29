/* SATOI service worker ― installability + 軽いオフライン耐性（network-first）
 * 2026-05-29: cache version bump to v2, 古いキャッシュを強制削除 */
const CACHE = 'satoi-v2-20260529';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        try {
          const copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        } catch (_) {}
        return res;
      })
      .catch(function () { return caches.match(e.request); })
  );
});
