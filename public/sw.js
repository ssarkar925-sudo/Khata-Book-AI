const CACHE_NAME = 'record-book-v5';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
];

const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Record Book</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #070a12; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; text-align: center; }
    .card { background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 36px 24px; max-width: 360px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
    .logo { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #a855f7, #14b8a6); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: white; margin: 0 auto 20px auto; }
    h1 { font-size: 19px; font-weight: 700; margin-bottom: 8px; color: #ffffff; }
    p { font-size: 13.5px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
    .btn { width: 100%; background: linear-gradient(135deg, #4f46e5, #6366f1); color: #ffffff; font-weight: 600; font-size: 14.5px; padding: 13px 20px; border: none; border-radius: 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">RB</div>
    <h1>Reconnecting...</h1>
    <p>Record Book will automatically refresh as soon as your connection is restored.</p>
    <button class="btn" onclick="window.location.reload()">Reload Now</button>
  </div>
  <script>
    window.addEventListener('online', function() { window.location.reload(); });
    setInterval(function() {
      if (navigator.onLine) {
        fetch('/', { method: 'HEAD', cache: 'no-store' }).then(function() { window.location.reload(); }).catch(function(){});
      }
    }, 2500);
  </script>
</body>
</html>`;

// Install: Cache essential assets safely without breaking if one fails
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Could not pre-cache asset:', asset, err);
        }
      }
    })
  );
});

// Activate: Immediately claim clients and purge old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-First strategy with guaranteed valid Response fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass Supabase Realtime / REST APIs and non-GET requests
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Handle HTML document navigation requests
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const offlinePage = (await caches.match('/offline.html')) || (await caches.match('/'));
          if (offlinePage) return offlinePage;
          return new Response(FALLBACK_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Handle static assets (CSS, JS, fonts, images)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Never return undefined to respondWith!
        return new Response('', { status: 504, statusText: 'Offline' });
      })
  );
});
