import { Hono } from 'hono';
import { eq, desc, and, lte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { verseSchedule, bibleVerses, bibleBooks, verseReadings } from '@unstpbl/db';
import { fetchVerseFromApi } from '../lib/bibleApi.js';
import { authMiddleware } from '../middleware/auth.js';
import { DEFAULT_FALLBACK_VERSE } from '@unstpbl/shared';

export const verseRoutes = new Hono();

async function getOrCreateTodayVerse(todayDate: string): Promise<any> {
  // 1. Try to fetch today's verse
  const todaySchedule = await db
    .select()
    .from(verseSchedule)
    .innerJoin(bibleVerses, eq(verseSchedule.verseId, bibleVerses.id))
    .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id))
    .where(eq(verseSchedule.date, todayDate))
    .limit(1);

  if (todaySchedule.length > 0) {
    return todaySchedule[0];
  }

  // 2. Try to fall back to the most recent scheduled verse
  const lastScheduled = await db
    .select()
    .from(verseSchedule)
    .innerJoin(bibleVerses, eq(verseSchedule.verseId, bibleVerses.id))
    .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id))
    .orderBy(desc(verseSchedule.date))
    .limit(1);

  if (lastScheduled.length > 0) {
    const last = lastScheduled[0];
    try {
      await db.insert(verseSchedule).values({
        date: todayDate,
        verseId: last.bible_verses.id,
        mode: 'sequential',
        bookId: last.bible_verses.bookId,
        chapter: last.bible_verses.chapter,
      });

      // Re-query to return joined structure
      const newToday = await db
        .select()
        .from(verseSchedule)
        .innerJoin(bibleVerses, eq(verseSchedule.verseId, bibleVerses.id))
        .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id))
        .where(eq(verseSchedule.date, todayDate))
        .limit(1);

      if (newToday.length > 0) {
        return newToday[0];
      }
    } catch (err) {
      console.error('Failed to auto-schedule last verse:', err);
    }
  }

  // 3. Fall back to Default Verse (Psalms 119:105)
  const books = await db
    .select()
    .from(bibleBooks)
    .where(eq(bibleBooks.abbreviation, 'PSA'))
    .limit(1);

  if (books.length === 0) {
    throw new Error('Bible books are not seeded (PSA not found).');
  }
  const psaBook = books[0];

  // Check if verse is cached
  const verse = await db
    .select()
    .from(bibleVerses)
    .where(
      and(
        eq(bibleVerses.bookId, psaBook.id),
        eq(bibleVerses.chapter, 119),
        eq(bibleVerses.verseNumber, 105)
      )
    )
    .limit(1);

  let dbVerseId: number;

  if (verse.length === 0) {
    try {
      const text = await fetchVerseFromApi('PSA', 119, 105);
      const inserted = await db
        .insert(bibleVerses)
        .values({
          bookId: psaBook.id,
          chapter: 119,
          verseNumber: 105,
          text,
          translation: 'KJV',
        })
        .returning();
      dbVerseId = inserted[0].id;
    } catch (err) {
      console.error('Failed to fetch default verse from api.bible:', err);
      const inserted = await db
        .insert(bibleVerses)
        .values({
          bookId: psaBook.id,
          chapter: 119,
          verseNumber: 105,
          text: DEFAULT_FALLBACK_VERSE.text,
          translation: 'KJV',
        })
        .returning();
      dbVerseId = inserted[0].id;
    }
  } else {
    dbVerseId = verse[0].id;
  }

  // Insert into verse schedule
  await db.insert(verseSchedule).values({
    date: todayDate,
    verseId: dbVerseId,
    mode: 'manual',
    bookId: psaBook.id,
    chapter: 119,
  });

  const finalToday = await db
    .select()
    .from(verseSchedule)
    .innerJoin(bibleVerses, eq(verseSchedule.verseId, bibleVerses.id))
    .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id))
    .where(eq(verseSchedule.date, todayDate))
    .limit(1);

  return finalToday[0];
}

/**
 * GET /verses/today — Returns today's scheduled verse.
 */
verseRoutes.get('/verses/today', async (c) => {
  try {
    const timezone = process.env.CHURCH_TIMEZONE || 'Africa/Harare';
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const result = await getOrCreateTodayVerse(today);

    return c.json({
      schedule: {
        id: result.verse_schedule.id,
        date: result.verse_schedule.date,
        verseId: result.verse_schedule.verseId,
        mode: result.verse_schedule.mode,
      },
      verse: {
        id: result.bible_verses.id,
        bookId: result.bible_verses.bookId,
        chapter: result.bible_verses.chapter,
        verseNumber: result.bible_verses.verseNumber,
        text: result.bible_verses.text,
        translation: result.bible_verses.translation,
      },
      book: {
        id: result.bible_books.id,
        name: result.bible_books.name,
        abbreviation: result.bible_books.abbreviation,
        testament: result.bible_books.testament,
      },
    });
  } catch (err: any) {
    console.error('Error fetching today\'s verse:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /verses/history — Returns last N days of verses.
 */
verseRoutes.get('/verses/history', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10);
    const timezone = process.env.CHURCH_TIMEZONE || 'Africa/Harare';
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const history = await db
      .select()
      .from(verseSchedule)
      .innerJoin(bibleVerses, eq(verseSchedule.verseId, bibleVerses.id))
      .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id))
      .where(lte(verseSchedule.date, today))
      .orderBy(desc(verseSchedule.date))
      .limit(days);

    const formatted = history.map((row) => ({
      schedule: {
        id: row.verse_schedule.id,
        date: row.verse_schedule.date,
        verseId: row.verse_schedule.verseId,
        mode: row.verse_schedule.mode,
      },
      verse: {
        id: row.bible_verses.id,
        bookId: row.bible_verses.bookId,
        chapter: row.bible_verses.chapter,
        verseNumber: row.bible_verses.verseNumber,
        text: row.bible_verses.text,
        translation: row.bible_verses.translation,
      },
      book: {
        id: row.bible_books.id,
        name: row.bible_books.name,
        abbreviation: row.bible_books.abbreviation,
        testament: row.bible_books.testament,
      },
    }));

    return c.json({ verses: formatted, days });
  } catch (err: any) {
    console.error('Error fetching verse history:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /verses/read — Marks a verse as read.
 */
verseRoutes.post('/verses/read', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const { verseScheduleId } = await c.req.json();

    if (!verseScheduleId) {
      return c.json({ error: 'Missing verseScheduleId' }, 400);
    }

    try {
      await db.insert(verseReadings).values({
        userId: user.id,
        verseScheduleId,
      });
    } catch (err) {
      // Ignore unique constraint violation (already read)
      console.log(`User ${user.id} has already read schedule ${verseScheduleId}`);
    }

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error marking verse as read:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
