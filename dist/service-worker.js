const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `grüner-faktencheck-${CACHE_VERSION}`;
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/style.css',
  '/favicon.ico',
  '/manifest.json',
  '/robots.txt',
  '/sitemap.xml'
];

// Service Worker Installation
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch(error => console.error('Cache failed:', error))
  );
  self.skipWaiting();
});

// Service Worker Aktivation
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First Strategy für API-Requests
// Cache-First Strategy für Assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Force Network-First for navigation requests and the articles API
  // so the overview is always fresh on each page load.
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname === '/api/articles') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(response => response || new Response('Offline - Ressource nicht verfügbar', { status: 503 }));
        })
    );
    return;
  }
  // Für externe URLs (Articles): Network-First
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(response => response || new Response('Offline - Artikel nicht verfügbar', { status: 503 }));
        })
    );
    return;
  }

  // Für lokale Assets: Cache-First
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
            return response;
          })
          .catch(() => {
            return new Response('Offline - Ressource nicht verfügbar', { status: 503 });
          });
      })
  );
});

// Background Sync für bessere Offline-Unterstützung
self.addEventListener('sync', event => {
  if (event.tag === 'sync-articles') {
    event.waitUntil(
      fetch('/api/articles')
        .then(response => response.json())
        .then(data => {
          return caches.open(CACHE_NAME).then(cache => {
            return cache.put('/api/articles', new Response(JSON.stringify(data)));
          });
        })
    );
  }
});

// Push Notifications Support
self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body || 'Neue Artikel verfügbar',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'grüner-faktencheck-notification',
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Grüner Faktencheck', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
