import webpush from 'web-push';
import { db } from './db.js';
import { users, scheduledPushNotifications, eq, and, isNotNull, lte } from '@unstpbl/db';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@yourchurch.com';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else if (process.env.NODE_ENV !== 'test') {
  console.warn('VAPID keys are missing. Web Push notifications will not work.');
}

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  excludeUserIds?: string[];
}

export interface PushDispatchResult {
  sent: number;
  failed: number;
}

export interface ScheduledPushDispatchResult extends PushDispatchResult {
  processed: number;
}

export async function sendPushToSubscribers(message: PushMessage): Promise<PushDispatchResult> {
  const excludedUsers = new Set(message.excludeUserIds || []);
  const subscribedUsers = await db
    .select({ id: users.id, pushSubscription: users.pushSubscription })
    .from(users)
    .where(isNotNull(users.pushSubscription));

  const payload = JSON.stringify({
    notification: {
      title: message.title,
      body: message.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: {
        url: message.url || '/',
      },
    },
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscribedUsers.map(async (userObj) => {
      if (excludedUsers.has(userObj.id)) return;

      const sub = userObj.pushSubscription as webpush.PushSubscription;
      try {
        await webpush.sendNotification(sub, payload);
        sent += 1;
      } catch (err: any) {
        console.error(`Failed to send push notification to user ${userObj.id}:`, err.message);
        failed += 1;
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db
            .update(users)
            .set({ pushSubscription: null })
            .where(eq(users.id, userObj.id));
        }
      }
    }),
  );

  return { sent, failed };
}

export async function dispatchDueScheduledPushNotifications(now = new Date()): Promise<ScheduledPushDispatchResult> {
  const dueNotifications = await db
    .select()
    .from(scheduledPushNotifications)
    .where(
      and(
        eq(scheduledPushNotifications.status, 'scheduled'),
        lte(scheduledPushNotifications.scheduledFor, now),
      ),
    )
    .limit(20);

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const notification of dueNotifications) {
    const result = await sendPushToSubscribers({
      title: notification.title,
      body: notification.body,
      url: notification.url || undefined,
    });

    processed += 1;
    sent += result.sent;
    failed += result.failed;

    await db
      .update(scheduledPushNotifications)
      .set({ status: 'sent', sentAt: now })
      .where(eq(scheduledPushNotifications.id, notification.id));
  }

  return { processed, sent, failed };
}
