import { Hono } from 'hono';
import webpush from 'web-push';
import { db } from '../lib/db.js';
import { users, eq, isNotNull } from '@unstpbl/db';
import { authMiddleware } from '../middleware/auth.js';

export const pushRoutes = new Hono();

// Apply auth middleware to all push routes
pushRoutes.use('*', authMiddleware);

// Initialize VAPID details
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@yourchurch.com';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn("⚠️ VAPID keys are missing! Web Push notifications will not work.");
}

/**
 * POST /push/subscribe — Save subscription payload for authenticated user.
 */
pushRoutes.post('/push/subscribe', async (c) => {
  try {
    const authUser = c.get('user');
    const subscription = await c.req.json();

    if (!subscription || !subscription.endpoint) {
      return c.json({ error: 'Invalid subscription payload' }, 400);
    }

    await db
      .update(users)
      .set({ pushSubscription: subscription })
      .where(eq(users.id, authUser.id));

    return c.json({ success: true, message: 'Push subscription saved successfully.' });
  } catch (err: any) {
    console.error('Error saving push subscription:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /push/unsubscribe — Clear push subscription for authenticated user.
 */
pushRoutes.post('/push/unsubscribe', async (c) => {
  try {
    const authUser = c.get('user');

    await db
      .update(users)
      .set({ pushSubscription: null })
      .where(eq(users.id, authUser.id));

    return c.json({ success: true, message: 'Push subscription cleared successfully.' });
  } catch (err: any) {
    console.error('Error clearing push subscription:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /admin/push/send — Send push notification to all subscribed users.
 * Admin/Bishop only.
 */
pushRoutes.post('/admin/push/send', async (c) => {
  try {
    const authUser = c.get('user');

    // Role check
    if (authUser.role !== 'admin' && authUser.role !== 'bishop') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const { title, body, url } = await c.req.json();

    if (!title || !body) {
      return c.json({ error: 'Title and body are required' }, 400);
    }

    // Fetch all users with a registered subscription
    const subscribedUsers = await db
      .select({ id: users.id, pushSubscription: users.pushSubscription })
      .from(users)
      .where(isNotNull(users.pushSubscription));

    const payload = JSON.stringify({
      notification: {
        title,
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: {
          url: url || '/',
        },
      },
    });

    let successCount = 0;
    let failCount = 0;

    const promises = subscribedUsers.map(async (userObj) => {
      const sub = userObj.pushSubscription as any;
      try {
        await webpush.sendNotification(sub, payload);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to send push notification to user ${userObj.id}:`, err.message);
        failCount++;
        // Prune dead subscriptions (Gone 410 or Not Found 404)
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Pruning dead push subscription for user ${userObj.id}`);
          await db
            .update(users)
            .set({ pushSubscription: null })
            .where(eq(users.id, userObj.id));
        }
      }
    });

    await Promise.all(promises);

    return c.json({
      success: true,
      sent: successCount,
      failed: failCount,
    });
  } catch (err: any) {
    console.error('Error sending push notifications:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
