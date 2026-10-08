import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { bishopMiddleware } from '../middleware/bishop.js';
import {
  dispatchTodaysBirthdayAnnouncements,
  getBirthdayWall,
  getUpcomingBirthdays,
} from '../lib/birthdayDispatcher.js';

export const birthdayRoutes = new Hono();

// Scoped to actual prefixes rather than '*' — see admin.ts for why a bare '*'
// leaks across every other sub-app mounted at the same base path.
birthdayRoutes.use('/birthdays', authMiddleware);
birthdayRoutes.use('/birthdays/*', authMiddleware);

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

// Broadcasts a push notification to the whole congregation, so bishops/admins only.
birthdayRoutes.post('/birthdays/dispatch-today', bishopMiddleware, async (c) => {
  try {
    const result = await dispatchTodaysBirthdayAnnouncements();
    return c.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Error dispatching birthday announcements:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
