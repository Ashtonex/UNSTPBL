import 'dotenv/config';
import { dispatchDueScheduledPushNotifications } from '../lib/pushDispatcher.js';

try {
  const result = await dispatchDueScheduledPushNotifications();
  console.log(
    `Scheduled push dispatch complete: processed=${result.processed}, sent=${result.sent}, failed=${result.failed}`,
  );
  process.exit(0);
} catch (err) {
  console.error('Scheduled push dispatch failed:', err);
  process.exit(1);
}
