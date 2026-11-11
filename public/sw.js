// Service worker (2026-11-11): notifications only.
// No 'fetch' handler and no cache on purpose: every page still comes from the
// network / edge cache exactly as before, so speed and SEO are unchanged.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const beacon = (n, x) => fetch('/api/e', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ n, v: 'sw', p: '/sw', x }), keepalive: true }).catch(() => {});

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let d = null;
    try { d = e.data ? e.data.json() : null; } catch {}
    if (!d || !d.title) {
      // old payload-less push: ask the server what the newest alert is
      d = { title: 'Restock alert', body: 'Something you watch is back in stock.', url: '/account' };
      try { const r = await fetch('/api/me/latest', { credentials: 'include' }); if (r.ok) d = await r.json(); } catch {}
    }
    await self.registration.showNotification(d.title, {
      body: d.body, tag: d.tag, renotify: !!d.tag, data: { url: d.url || '/account', tag: d.tag || '' },
      icon: '/icon-192.png', badge: '/icon-192.png',
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const { url, tag } = e.notification.data || {};
  let host = '';
  try { host = new URL(url, self.location.origin).hostname; } catch {}
  e.waitUntil(Promise.all([
    beacon('push_click', { kind: String(tag).startsWith('r') ? 'alert' : tag || 'other', host }),
    self.clients.openWindow(url || '/account'),
  ]));
});

// The browser renewed the subscription: hand the new one to the server (signed-in cookie travels with it)
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    const sub = e.newSubscription || (e.oldSubscription && await self.registration.pushManager.subscribe(e.oldSubscription.options).catch(() => null));
    if (sub) await fetch('/api/me/push', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), from: 'renew' }) }).catch(() => {});
  })());
});
