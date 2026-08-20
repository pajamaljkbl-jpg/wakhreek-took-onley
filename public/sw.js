self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || '📞 Appel Wakh Reek';
  const tag = data.tag || `wakhreek-call-${data.callId || Date.now()}`;
  const timeoutMs = Number(data.timeoutMs) || 45000;
  const options = {
    body: data.body || 'Appel entrant',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [700, 250, 700, 250, 700, 500, 900],
    data: { url: data.url || '/', callId: data.callId || null, expiresAt: Date.now() + timeoutMs },
    actions: [
      { action: 'answer', title: '📞 Répondre' },
      { action: 'open', title: 'Ouvrir' }
    ]
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    const notifications = await self.registration.getNotifications({ tag });
    notifications.forEach((notification) => notification.close());
  })());
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
