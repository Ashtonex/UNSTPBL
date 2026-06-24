import { Hono } from 'hono';
import { db } from '../lib/db.js';
import {
  bibleBooks,
  bibleVerses,
  verseSchedule,
  verseReadings,
  users,
  eq,
  count,
  and,
  gte
} from '@unstpbl/db';
import { fetchVerseFromApi } from '../lib/bibleApi.js';
import { authMiddleware } from '../middleware/auth.js';
import { bishopMiddleware } from '../middleware/bishop.js';
import { adminOnlyMiddleware } from '../middleware/admin.js';

export const adminRoutes = new Hono();

// Apply auth and bishop guards to all admin endpoints
adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', bishopMiddleware);

/**
 * GET /admin/users — Get list of all registered users (Admin only).
 */
adminRoutes.get('/admin/users', adminOnlyMiddleware, async (c) => {
  try {
    const userRecords = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        displayName: users.displayName,
        congregation: users.congregation,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.email);

    return c.json({ users: userRecords });
  } catch (err: any) {
    console.error('Error fetching admin users list:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * PUT /admin/users/:userId/role — Update a user's role (Admin only).
 */
adminRoutes.put('/admin/users/:userId/role', adminOnlyMiddleware, async (c) => {
  try {
    const userId = c.req.param('userId');
    const { role } = await c.req.json();

    if (!role || (role !== 'member' && role !== 'bishop' && role !== 'admin')) {
      return c.json({ error: 'Invalid or missing role' }, 400);
    }

    await db
      .update(users)
      .set({ role })
      .where(eq(users.id, userId));

    return c.json({ success: true, message: `User role updated to ${role} successfully.` });
  } catch (err: any) {
    console.error('Error updating user role:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /admin/stats/trends — Get signups and verse reading completions trend for last 30 days.
 */
adminRoutes.get('/admin/stats/trends', async (c) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const userRecords = await db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(gte(users.createdAt, thirtyDaysAgo));

    const readingRecords = await db
      .select({ readAt: verseReadings.readAt })
      .from(verseReadings)
      .where(gte(verseReadings.readAt, thirtyDaysAgo));

    const trendMap: Record<string, { date: string; signups: number; reads: number }> = {};
    
    // Initialize the last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      trendMap[dateStr] = { date: dateStr, signups: 0, reads: 0 };
    }

    // Group user signups
    for (const record of userRecords) {
      const dateStr = new Date(record.createdAt).toISOString().split('T')[0];
      if (trendMap[dateStr]) {
        trendMap[dateStr].signups++;
      }
    }

    // Group readings
    for (const record of readingRecords) {
      const dateStr = new Date(record.readAt).toISOString().split('T')[0];
      if (trendMap[dateStr]) {
        trendMap[dateStr].reads++;
      }
    }

    const trends = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));
    return c.json({ trends });
  } catch (err: any) {
    console.error('Error fetching admin stats trends:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /admin/stats/translations — Get breakdown of users preferred translations.
 */
adminRoutes.get('/admin/stats/translations', async (c) => {
  try {
    const translationCounts = await db
      .select({
        translation: users.translation,
        value: count()
      })
      .from(users)
      .groupBy(users.translation);

    const translations = translationCounts.map(tc => ({
      name: tc.translation || 'KJV',
      value: tc.value
    }));

    return c.json({ translations });
  } catch (err: any) {
    console.error('Error fetching translation stats:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /admin/books — Get all books in database for scheduling dropdowns.
 */
adminRoutes.get('/admin/books', async (c) => {
  try {
    const books = await db.select().from(bibleBooks).orderBy(bibleBooks.id);
    return c.json({ books });
  } catch (err: any) {
    console.error('Error fetching admin books:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /admin/stats — Get dashboard stats (member count and today's read rate).
 */
adminRoutes.get('/admin/stats', async (c) => {
  try {
    // 1. Get total member count
    const memberCountResult = await db
      .select({ val: count() })
      .from(users)
      .where(eq(users.role, 'member'));
    const memberCount = memberCountResult[0]?.val ?? 0;

    // 2. Get today's read rate
    const timezone = process.env.CHURCH_TIMEZONE || 'Africa/Harare';
    const todayDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const todaySchedule = await db
      .select()
      .from(verseSchedule)
      .where(eq(verseSchedule.date, todayDate))
      .limit(1);

    let readRate = 0;
    if (todaySchedule.length > 0 && memberCount > 0) {
      const todayReadingsResult = await db
        .select({ val: count() })
        .from(verseReadings)
        .where(eq(verseReadings.verseScheduleId, todaySchedule[0].id));
      const todayReadings = todayReadingsResult[0]?.val ?? 0;
      readRate = Math.round((todayReadings / memberCount) * 100);
    }

    return c.json({
      memberCount,
      readRate,
    });
  } catch (err: any) {
    console.error('Error fetching admin stats:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /admin/schedule — Schedules a verse for a specific date.
 */
adminRoutes.post('/admin/schedule', async (c) => {
  try {
    const { date, bookId, chapter, verseNumber } = await c.req.json();

    if (!date || !bookId || !chapter || !verseNumber) {
      return c.json({ error: 'Missing required fields: date, bookId, chapter, verseNumber' }, 400);
    }

    // 1. Retrieve book metadata to get API abbreviation
    const books = await db.select().from(bibleBooks).where(eq(bibleBooks.id, bookId)).limit(1);
    if (books.length === 0) {
      return c.json({ error: 'Book not found' }, 404);
    }
    const book = books[0];

    // 2. Check if the verse already exists in database cache
    const existingVerse = await db
      .select()
      .from(bibleVerses)
      .where(
        and(
          eq(bibleVerses.bookId, bookId),
          eq(bibleVerses.chapter, chapter),
          eq(bibleVerses.verseNumber, verseNumber)
        )
      )
      .limit(1);

    let dbVerseId: number;

    if (existingVerse.length === 0) {
      // Fetch from api.bible and cache
      try {
        const text = await fetchVerseFromApi(book.abbreviation, chapter, verseNumber);
        const inserted = await db
          .insert(bibleVerses)
          .values({
            bookId,
            chapter,
            verseNumber,
            text,
            translation: 'KJV',
          })
          .returning();
        dbVerseId = inserted[0].id;
      } catch (err: any) {
        console.error('Failed to fetch scheduled verse from api.bible:', err);
        return c.json({ error: `Bible API fetch failed: ${err.message}` }, 502);
      }
    } else {
      dbVerseId = existingVerse[0].id;
    }

    // 3. Upsert into verse schedule
    const existingSchedule = await db
      .select()
      .from(verseSchedule)
      .where(eq(verseSchedule.date, date))
      .limit(1);

    if (existingSchedule.length > 0) {
      await db
        .update(verseSchedule)
        .set({
          verseId: dbVerseId,
          bookId,
          chapter,
          mode: 'manual',
        })
        .where(eq(verseSchedule.date, date));
    } else {
      await db.insert(verseSchedule).values({
        date,
        verseId: dbVerseId,
        bookId,
        chapter,
        mode: 'manual',
      });
    }

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error scheduling verse:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
