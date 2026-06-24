import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { db } from '../lib/db.js';
import {
  verseSchedule,
  bibleVerses,
  bibleBooks,
  verseReadings,
  users,
  eq,
  desc,
  and,
  lte,
  gt,
  asc
} from '@unstpbl/db';
import { fetchVerseFromApi, fetchVerseFromEsv } from '../lib/bibleApi.js';
import { authMiddleware } from '../middleware/auth.js';
import { DEFAULT_FALLBACK_VERSE } from '@unstpbl/shared';

export const verseRoutes = new Hono();

/**
 * Resolves the user's preferred Bible translation from the authorization token.
 */
async function getPreferredTranslation(c: any): Promise<string> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return 'KJV';
  }
  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return 'KJV';
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return 'KJV';

    const dbUsers = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (dbUsers.length > 0) {
      return dbUsers[0].translation || 'KJV';
    }
    return 'KJV';
  } catch (e) {
    return 'KJV';
  }
}

/**
 * Resolves a scripture passage in the desired translation.
 * Uses database cache first, then API fallback, then caches it.
 */
async function resolveVerseInTranslation(
  bookId: number,
  bookName: string,
  abbreviation: string,
  chapter: number,
  verseNumber: number,
  translation: string
): Promise<{ id: number; bookId: number; chapter: number; verseNumber: number; text: string; translation: string }> {
  // 1. Check database cache
  const cached = await db
    .select()
    .from(bibleVerses)
    .where(
      and(
        eq(bibleVerses.bookId, bookId),
        eq(bibleVerses.chapter, chapter),
        eq(bibleVerses.verseNumber, verseNumber),
        eq(bibleVerses.translation, translation)
      )
    )
    .limit(1);

  if (cached.length > 0) {
    return cached[0];
  }

  // 2. Fetch from appropriate API
  console.log(`Cache miss for ${bookName} ${chapter}:${verseNumber} in ${translation}. Fetching...`);
  let text = '';
  if (translation === 'ESV') {
    try {
      text = await fetchVerseFromEsv(bookName, chapter, verseNumber);
    } catch (err) {
      console.error(`Failed to fetch from ESV API, falling back to KJV text:`, err);
      // Fallback to KJV text if ESV fetch fails
      const kjvVerse = await resolveVerseInTranslation(bookId, bookName, abbreviation, chapter, verseNumber, 'KJV');
      text = kjvVerse.text;
    }
  } else {
    // KJV
    try {
      text = await fetchVerseFromApi(abbreviation, chapter, verseNumber);
    } catch (err) {
      console.error(`Failed to fetch from Bible API:`, err);
      text = DEFAULT_FALLBACK_VERSE.text;
    }
  }

  // 3. Cache in database
  const [inserted] = await db
    .insert(bibleVerses)
    .values({
      bookId,
      chapter,
      verseNumber,
      text,
      translation,
    })
    .returning();

  return inserted;
}

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

  // 2. Try to fall back to the most recent scheduled verse, but incrementing sequentially from bible_verses cache
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
      // Find the next verse in bible_verses where ID is greater than the last scheduled verse's verseId
      let nextVerse = await db
        .select()
        .from(bibleVerses)
        .where(gt(bibleVerses.id, last.verse_schedule.verseId))
        .orderBy(asc(bibleVerses.id))
        .limit(1);

      // If no verse with greater ID is found, fall back to the first verse in bible_verses
      if (nextVerse.length === 0) {
        nextVerse = await db
          .select()
          .from(bibleVerses)
          .orderBy(asc(bibleVerses.id))
          .limit(1);
      }

      if (nextVerse.length > 0) {
        const targetVerse = nextVerse[0];
        await db.insert(verseSchedule).values({
          date: todayDate,
          verseId: targetVerse.id,
          mode: 'sequential',
          bookId: targetVerse.bookId,
          chapter: targetVerse.chapter,
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

  // Check if verse is cached in KJV
  const verse = await db
    .select()
    .from(bibleVerses)
    .where(
      and(
        eq(bibleVerses.bookId, psaBook.id),
        eq(bibleVerses.chapter, 119),
        eq(bibleVerses.verseNumber, 105),
        eq(bibleVerses.translation, 'KJV')
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
    const translation = await getPreferredTranslation(c);

    const resolvedVerse = await resolveVerseInTranslation(
      result.bible_books.id,
      result.bible_books.name,
      result.bible_books.abbreviation,
      result.bible_verses.chapter,
      result.bible_verses.verseNumber,
      translation
    );

    return c.json({
      schedule: {
        id: result.verse_schedule.id,
        date: result.verse_schedule.date,
        verseId: resolvedVerse.id,
        mode: result.verse_schedule.mode,
      },
      verse: {
        id: resolvedVerse.id,
        bookId: resolvedVerse.bookId,
        chapter: resolvedVerse.chapter,
        verseNumber: resolvedVerse.verseNumber,
        text: resolvedVerse.text,
        translation: resolvedVerse.translation,
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

    const translation = await getPreferredTranslation(c);

    const formatted = await Promise.all(history.map(async (row) => {
      const resolvedVerse = await resolveVerseInTranslation(
        row.bible_books.id,
        row.bible_books.name,
        row.bible_books.abbreviation,
        row.bible_verses.chapter,
        row.bible_verses.verseNumber,
        translation
      );

      return {
        schedule: {
          id: row.verse_schedule.id,
          date: row.verse_schedule.date,
          verseId: resolvedVerse.id,
          mode: row.verse_schedule.mode,
        },
        verse: {
          id: resolvedVerse.id,
          bookId: resolvedVerse.bookId,
          chapter: resolvedVerse.chapter,
          verseNumber: resolvedVerse.verseNumber,
          text: resolvedVerse.text,
          translation: resolvedVerse.translation,
        },
        book: {
          id: row.bible_books.id,
          name: row.bible_books.name,
          abbreviation: row.bible_books.abbreviation,
          testament: row.bible_books.testament,
        },
      };
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
