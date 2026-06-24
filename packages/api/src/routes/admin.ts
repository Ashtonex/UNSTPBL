import { Hono } from 'hono';
import { eq, count, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { bibleBooks, bibleVerses, verseSchedule, verseReadings, users } from '@unstpbl/db';
import { fetchVerseFromApi } from '../lib/bibleApi.js';
import { authMiddleware } from '../middleware/auth.js';
import { bishopMiddleware } from '../middleware/bishop.js';

export const adminRoutes = new Hono();

// Apply auth and bishop guards to all admin endpoints
adminRoutes.use('*', authMiddleware);
adminRoutes.use('*', bishopMiddleware);

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
