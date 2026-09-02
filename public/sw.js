const CACHE_NAME = 'convert-to-pdf-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 1. Install Event: Simpan aset statis ke cache browser
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mencache aset statis...');
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => console.warn('[SW] Gagal cache saat install:', err))
  );
});

// 2. Fetch Event: Strategi Network-First (Cek internet dulu, fallback ke cache)
self.addEventListener('fetch', (event) => {
  // Abaikan request non-GET (seperti POST upload file)
  if (event.request.method !== 'GET') return;
  
  // Abaikan endpoint API (selalu ambil dari server, jangan di-cache)
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Jika sukses, simpan salinan ke cache untuk akses berikutnya
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Jika tidak ada internet, ambil dari cache
        return caches.match(event.request).then((response) => {
          return response || new Response('Offline: UI hanya bisa dimuat dari cache.');
        });
      })
  );
});

// 3. Activate Event: Hapus cache lama jika ada update versi
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});