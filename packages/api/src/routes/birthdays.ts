import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  dispatchTodaysBirthdayAnnouncements,
  getBirthdayWall,
  getUpcomingBirthdays,
} from '../lib/birthdayDispatcher.js';

export const birthdayRoutes = new Hono();

birthdayRoutes.use('*', authMiddleware);

birthdayRoutes.get('/birthdays', async (c) => {
  try {
    const [wall, upcoming] = await Promise.all([
      getBirthdayWall(30),
      getUpcomingBirthdays(new Date(), 45),
    ]);

    return c.json({ wall, upcoming });
  } catch (err: any) {
    console.error('Error fetching birthday wall:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

birthdayRoutes.post('/birthdays/dispatch-today', async (c) => {
  try {
    const result = await dispatchTodaysBirthdayAnnouncements();
    return c.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error dispatching birthday announcements:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
