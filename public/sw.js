/* eslint-disable no-restricted-globals */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Obsługa powiadomień systemowych
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'Masz nową wiadomość',
    icon: '/logo.png', // Możesz podmienić na realną ikonę
    badge: '/logo.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'AutoOlx', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow(event.notification.data.url)
  );
});
