import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { users, scheduledPushNotifications, eq, desc } from '@unstpbl/db';
import { authMiddleware } from '../middleware/auth.js';
import {
  validatePushMessageBody,
  validatePushSubscriptionBody,
  validateScheduledPushBody,
} from '../lib/validation.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import { recordAuditLog } from '../lib/audit.js';
import { dispatchDueScheduledPushNotifications, sendPushToSubscribers } from '../lib/pushDispatcher.js';

export const pushRoutes = new Hono();

// Apply auth middleware to all push routes
pushRoutes.use('*', authMiddleware);

/**
 * POST /push/subscribe — Save subscription payload for authenticated user.
 */
pushRoutes.post('/push/subscribe', async (c) => {
  try {
    const authUser = c.get('user');
    const validation = validatePushSubscriptionBody(await c.req.json());
    if (!validation.ok) return c.json({ error: validation.error }, 400);
    const subscription = validation.data;

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
pushRoutes.post(
  '/admin/push/send',
  createRateLimit({ windowMs: 60_000, max: 3, keyPrefix: 'admin-push-send' }),
  async (c) => {
  try {
    const authUser = c.get('user');

    // Role check
    if (authUser.role !== 'admin' && authUser.role !== 'bishop') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const validation = validatePushMessageBody(await c.req.json());
    if (!validation.ok) return c.json({ error: validation.error }, 400);
    const { title, body, url } = validation.data;

    const result = await sendPushToSubscribers({ title, body, url });

    await recordAuditLog({
      actor: authUser,
      action: 'push.sent',
      targetType: 'push_notification',
      metadata: { title, sent: result.sent, failed: result.failed },
    });

    return c.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err: any) {
    console.error('Error sending push notifications:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

pushRoutes.post(
  '/admin/push/dispatch-due',
  createRateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'admin-push-dispatch-due' }),
  async (c) => {
    try {
      const authUser = c.get('user');
      if (authUser.role !== 'admin' && authUser.role !== 'bishop') {
        return c.json({ error: 'Forbidden' }, 403);
      }

      const result = await dispatchDueScheduledPushNotifications();

      await recordAuditLog({
        actor: authUser,
        action: 'push.dispatch_due',
        targetType: 'scheduled_push_notification',
        metadata: { processed: result.processed, sent: result.sent, failed: result.failed },
      });

      return c.json({ success: true, ...result });
    } catch (err: any) {
      console.error('Error dispatching due push notifications:', err);
      return c.json({ error: err.message || 'Internal server error' }, 500);
    }
  },
);

pushRoutes.get('/admin/push/scheduled', async (c) => {
  try {
    const authUser = c.get('user');
    if (authUser.role !== 'admin' && authUser.role !== 'bishop') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const notifications = await db
      .select()
      .from(scheduledPushNotifications)
      .orderBy(desc(scheduledPushNotifications.scheduledFor))
      .limit(25);

    return c.json({ notifications });
  } catch (err: any) {
    console.error('Error fetching scheduled push notifications:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

pushRoutes.post('/admin/push/schedule', async (c) => {
  try {
    const authUser = c.get('user');
    if (authUser.role !== 'admin' && authUser.role !== 'bishop') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const validation = validateScheduledPushBody(await c.req.json());
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    const [notification] = await db
      .insert(scheduledPushNotifications)
      .values({
        createdByUserId: authUser.id,
        title: validation.data.title,
        body: validation.data.body,
        url: validation.data.url,
        scheduledFor: validation.data.scheduledFor,
      })
      .returning();

    await recordAuditLog({
      actor: authUser,
      action: 'push.scheduled',
      targetType: 'scheduled_push_notification',
      targetId: notification.id,
      metadata: { title: notification.title, scheduledFor: notification.scheduledFor },
    });

    return c.json({ notification });
  } catch (err: any) {
    console.error('Error scheduling push notification:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
