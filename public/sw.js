// Service worker: pushes carry no payload ("tickle"); we ask the server what the newest alert is.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let d = { title: 'Restock alert', body: 'Something you watch is back in stock.', url: '/account' };
    try { const r = await fetch('/api/me/latest', { credentials: 'include' }); if (r.ok) d = await r.json(); } catch {}
    await self.registration.showNotification(d.title, { body: d.body, data: { url: d.url }, icon: '/icon.svg', badge: '/icon.svg', requireInteraction: true });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url || '/account'));
});
