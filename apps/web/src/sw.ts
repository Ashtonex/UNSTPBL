import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// Precache resources
precacheAndRoute((self as any).__WB_MANIFEST || []);
cleanupOutdatedCaches();

// The app shows "A new version is available"; tapping Refresh sends this message so the
// waiting service worker takes over (see components/UpdatePrompt.tsx).
self.addEventListener('message', (event: any) => {
  if (event.data?.type === 'SKIP_WAITING') (self as any).skipWaiting();
});

// Cache the public verse feeds (NetworkFirst) so they still load offline.
// Deliberately NOT a blanket /verses/* match: that also caught /verses/favorites
// and /verses/reflections, which are personal, and the cache is shared by every
// account that signs in on the same device.
const PUBLIC_VERSE_PATHS = new Set(['/verses/today', '/verses/history']);

registerRoute(
  ({ url }) => PUBLIC_VERSE_PATHS.has(url.pathname),
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

// Handle notification click: focus an open app window and take it to the notification's
// target page (the server sends it as data.url), or open a new window there.
self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();

  const origin = self.location.origin;
  let target = new URL('/', origin);
  try {
    const candidate = new URL(event.notification.data?.url || '/', origin);
    // Never navigate to another site because of a notification payload.
    if (candidate.origin === origin) target = candidate;
  } catch {
    // Malformed URL in the payload: fall back to the home screen.
  }

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        // client.url is a string, so compare origins (it has no .pathname).
        if (new URL(client.url).origin === origin && 'focus' in client) {
          return client.focus().then((focused: any) =>
            focused && 'navigate' in focused ? focused.navigate(target.href) : focused,
          );
        }
      }
      if ((self as any).clients.openWindow) {
        return (self as any).clients.openWindow(target.href);
      }
    }),
  );
});
