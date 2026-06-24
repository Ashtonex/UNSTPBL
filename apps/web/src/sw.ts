import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// Precache resources
precacheAndRoute((self as any).__WB_MANIFEST || []);

// Cache daily verses using NetworkFirst strategy
registerRoute(
  /\/verses\/.*/,
  new NetworkFirst({
    cacheName: 'verse-cache',
  })
);

// Listen for Push Notification events
self.addEventListener('push', (event: any) => {
  let payload = { title: 'UNSTPBL Daily Verse', body: 'Read today\'s verse now!', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: '/' } };
  try {
    if (event.data) {
      const raw = event.data.json();
      if (raw.notification) {
        payload = {
          title: raw.notification.title || payload.title,
          body: raw.notification.body || payload.body,
          icon: raw.notification.icon || payload.icon,
          badge: raw.notification.badge || payload.badge,
          data: raw.notification.data || payload.data,
        };
      } else {
        payload = { ...payload, ...raw };
      }
    }
  } catch (e) {
    console.error('Failed to parse push event payload:', e);
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    data: payload.data,
  };

  event.waitUntil(
    (self as any).registration.showNotification(payload.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      // Focus existing window/tab if open
      for (const client of clientList) {
        if (client.url.pathname === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new one
      if ((self as any).clients.openWindow) {
        return (self as any).clients.openWindow('/');
      }
    })
  );
});
