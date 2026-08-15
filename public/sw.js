self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || '📞 Appel Wakh Reek';
  const options = {
    body: data.body || 'Appel entrant',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || `wakhreek-call-${data.callId || Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [500, 250, 500, 250, 800],
    data: { url: data.url || '/', callId: data.callId || null },
    actions: [
      { action: 'answer', title: '📞 Répondre' },
      { action: 'open', title: 'Ouvrir' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        if ('navigate' in client) await client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
