import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { resolveAuth } from '../lib/authCache.js';
import { createMemoCache } from '../lib/memoCache.js';
import {
  verseSchedule,
  bibleVerses,
  bibleBooks,
  verseReadings,
  users,
  favoriteVerses,
  verseReflections,
  prayerRequests,
  prayerJoins,
  eq,
  desc,
  and,
  count,
  lte,
  gt,
  asc,
  or,
  ilike,
  sql
} from '@unstpbl/db';
import { fetchVerseFromApi, fetchVerseFromEsv } from '../lib/bibleApi.js';
import { authMiddleware } from '../middleware/auth.js';
import { DEFAULT_FALLBACK_VERSE } from '@unstpbl/shared';
import { getEmbedding, cosineSimilarity } from '../lib/embeddings.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import {
  validateDaysQuery,
  validatePrayerBody,
  validateReadBody,
  validateReflectionBody,
  validateSearchQuery,
  validateUuid,
  validateVerseIdBody,
} from '../lib/validation.js';

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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return 'KJV';
  }
  try {
    const auth = await resolveAuth(token);
    return auth?.translation || 'KJV';
  } catch (e) {
    return 'KJV';
  }
}

// Today's verse payload per date + translation. It only changes when an admin
// reschedules it (which invalidates this), so the TTL is just a safety net.
const TODAY_VERSE_TTL_MS = 5 * 60_000;
const todayVerseCache = createMemoCache<any>({ maxEntries: 20 });

export function invalidateTodayVerseCache(): void {
  todayVerseCache.invalidate();
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
    const row = cached[0];
    // If it doesn't have an embedding, compute it and save it
    if (!row.embedding) {
      try {
        const embedding = await getEmbedding(row.text);
        await db.update(bibleVerses).set({ embedding }).where(eq(bibleVerses.id, row.id));
        row.embedding = embedding;
      } catch (err) {
        console.error('Failed to compute missing embedding on cache hit:', err);
      }
    }
    return row as any;
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

  let embedding: number[] | null = null;
  try {
    embedding = await getEmbedding(text);
  } catch (err) {
    console.error('Failed to compute embedding during insert:', err);
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
      embedding,
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

    const translation = await getPreferredTranslation(c);

    const payload = await todayVerseCache.getOrLoad(`${today}:${translation}`, async () => {
      const result = await getOrCreateTodayVerse(today);

      const resolvedVerse = await resolveVerseInTranslation(
        result.bible_books.id,
        result.bible_books.name,
        result.bible_books.abbreviation,
        result.bible_verses.chapter,
        result.bible_verses.verseNumber,
        translation
      );

      return {
        ttlMs: TODAY_VERSE_TTL_MS,
        value: {
          schedule: {
            id: result.verse_schedule.id,
            date: result.verse_schedule.date,
            verseId: resolvedVerse.id,
            mode: result.verse_schedule.mode,
            pastoralNote: result.verse_schedule.pastoralNote,
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
        },
      };
    });

    return c.json(payload);
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
    const daysValidation = validateDaysQuery(c.req.query('days'));
    if (!daysValidation.ok) return c.json({ error: daysValidation.error }, 400);
    const days = daysValidation.data;
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
          pastoralNote: row.verse_schedule.pastoralNote,
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
    const validation = validateReadBody(await c.req.json());
    if (!validation.ok) return c.json({ error: validation.error }, 400);
    const { verseScheduleId } = validation.data;

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

verseRoutes.get('/me/progress', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const readings = await db
      .select({
        readAt: verseReadings.readAt,
        date: verseSchedule.date,
      })
      .from(verseReadings)
      .innerJoin(verseSchedule, eq(verseReadings.verseScheduleId, verseSchedule.id))
      .where(eq(verseReadings.userId, user.id))
      .orderBy(desc(verseSchedule.date));

    const favoriteCount = await db
      .select({ val: count() })
      .from(favoriteVerses)
      .where(eq(favoriteVerses.userId, user.id));

    const openPrayerCount = await db
      .select({ val: count() })
      .from(prayerRequests)
      .where(and(eq(prayerRequests.userId, user.id), eq(prayerRequests.status, 'open')));

    const readDates = new Set(readings.map((reading) => String(reading.date)));
    const timezone = process.env.CHURCH_TIMEZONE || 'Africa/Harare';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const cursor = new Date(`${formatter.format(new Date())}T00:00:00.000Z`);
    let streak = 0;

    while (readDates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    return c.json({
      totalReads: readings.length,
      currentStreak: streak,
      favoriteCount: favoriteCount[0]?.val ?? 0,
      openPrayerCount: openPrayerCount[0]?.val ?? 0,
      recentReadDates: Array.from(readDates).slice(0, 30),
    });
  } catch (err: any) {
    console.error('Error fetching user progress:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.get('/verses/favorites', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const favorites = await db
      .select({
        id: favoriteVerses.id,
        createdAt: favoriteVerses.createdAt,
        verseId: bibleVerses.id,
        text: bibleVerses.text,
        chapter: bibleVerses.chapter,
        verseNumber: bibleVerses.verseNumber,
        translation: bibleVerses.translation,
        bookName: bibleBooks.name,
        bookAbbreviation: bibleBooks.abbreviation,
      })
      .from(favoriteVerses)
      .innerJoin(bibleVerses, eq(favoriteVerses.verseId, bibleVerses.id))
      .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id))
      .where(eq(favoriteVerses.userId, user.id))
      .orderBy(desc(favoriteVerses.createdAt))
      .limit(20);

    return c.json({ favorites });
  } catch (err: any) {
    console.error('Error fetching favorite verses:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.post('/verses/favorites', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const validation = validateVerseIdBody(await c.req.json());
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    await db
      .insert(favoriteVerses)
      .values({ userId: user.id, verseId: validation.data.verseId })
      .onConflictDoNothing();

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error favoriting verse:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.delete('/verses/favorites/:verseId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const verseId = parseInt(c.req.param('verseId'), 10);
    if (!Number.isSafeInteger(verseId) || verseId < 1) return c.json({ error: 'Invalid verse ID' }, 400);

    await db
      .delete(favoriteVerses)
      .where(and(eq(favoriteVerses.userId, user.id), eq(favoriteVerses.verseId, verseId)));

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error removing favorite verse:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.get('/verses/reflections', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const verseScheduleId = c.req.query('verseScheduleId');
    const verseId = c.req.query('verseId');

    if (verseScheduleId) {
      const reflections = await db
        .select({
          id: verseReflections.id,
          userId: verseReflections.userId,
          verseId: verseReflections.verseId,
          verseScheduleId: verseReflections.verseScheduleId,
          content: verseReflections.content,
          createdAt: verseReflections.createdAt,
          user: {
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            congregation: users.congregation,
          }
        })
        .from(verseReflections)
        .innerJoin(users, eq(verseReflections.userId, users.id))
        .where(eq(verseReflections.verseScheduleId, verseScheduleId))
        .orderBy(desc(verseReflections.createdAt))
        .limit(50);
      return c.json({ reflections });
    }

    const filters = verseId
      ? and(eq(verseReflections.userId, user.id), eq(verseReflections.verseId, parseInt(verseId, 10)))
      : eq(verseReflections.userId, user.id);

    const reflections = await db
      .select()
      .from(verseReflections)
      .where(filters)
      .orderBy(desc(verseReflections.createdAt))
      .limit(20);

    return c.json({ reflections });
  } catch (err: any) {
    console.error('Error fetching reflections:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.post('/verses/reflections', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const validation = validateReflectionBody(await c.req.json());
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    const [reflection] = await db
      .insert(verseReflections)
      .values({ userId: user.id, ...validation.data })
      .returning();

    return c.json({ reflection });
  } catch (err: any) {
    console.error('Error saving reflection:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.get('/prayers', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user');
    const allPrayers = await db
      .select({
        id: prayerRequests.id,
        userId: prayerRequests.userId,
        title: prayerRequests.title,
        content: prayerRequests.content,
        status: prayerRequests.status,
        createdAt: prayerRequests.createdAt,
        answeredAt: prayerRequests.answeredAt,
        type: prayerRequests.type,
        isAnonymous: prayerRequests.isAnonymous,
        authorName: users.displayName,
        authorCongregation: users.congregation,
      })
      .from(prayerRequests)
      .innerJoin(users, eq(prayerRequests.userId, users.id))
      .orderBy(desc(prayerRequests.createdAt))
      .limit(100);

    const formatted = await Promise.all(allPrayers.map(async (prayer) => {
      const joinCountResult = await db
        .select({ val: count() })
        .from(prayerJoins)
        .where(eq(prayerJoins.prayerRequestId, prayer.id));
      const joinCount = joinCountResult[0]?.val ?? 0;

      const userJoin = await db
        .select()
        .from(prayerJoins)
        .where(and(eq(prayerJoins.prayerRequestId, prayer.id), eq(prayerJoins.userId, currentUser.id)))
        .limit(1);

      const hasJoined = userJoin.length > 0;

      return {
        id: prayer.id,
        userId: prayer.userId,
        title: prayer.title,
        content: prayer.content,
        status: prayer.status,
        createdAt: prayer.createdAt,
        answeredAt: prayer.answeredAt,
        type: prayer.type || 'request',
        isAnonymous: prayer.isAnonymous || false,
        user: prayer.isAnonymous ? { displayName: 'Anonymous Member', congregation: null } : {
          displayName: prayer.authorName || 'Family Member',
          congregation: prayer.authorCongregation
        },
        _count: {
          joins: joinCount
        },
        hasJoined
      };
    }));

    return c.json({ prayers: formatted });
  } catch (err: any) {
    console.error('Error fetching prayer requests:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.post('/prayers', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const validation = validatePrayerBody(await c.req.json());
    if (!validation.ok) return c.json({ error: validation.error }, 400);

    const [prayer] = await db
      .insert(prayerRequests)
      .values({
        userId: user.id,
        title: validation.data.title,
        content: validation.data.content,
        type: validation.data.type || 'request',
        isAnonymous: validation.data.isAnonymous || false,
      })
      .returning();

    return c.json({ prayer });
  } catch (err: any) {
    console.error('Error creating prayer request:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.post('/prayers/:id/join', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const idValidation = validateUuid(c.req.param('id'), 'id');
    if (!idValidation.ok) return c.json({ error: idValidation.error }, 400);

    const prayerId = idValidation.data;

    const prayer = await db.select().from(prayerRequests).where(eq(prayerRequests.id, prayerId)).limit(1);
    if (prayer.length === 0) {
      return c.json({ error: 'Prayer request not found' }, 404);
    }

    await db
      .insert(prayerJoins)
      .values({
        userId: user.id,
        prayerRequestId: prayerId,
      })
      .onConflictDoNothing();

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error joining prayer:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.delete('/prayers/:id/join', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const idValidation = validateUuid(c.req.param('id'), 'id');
    if (!idValidation.ok) return c.json({ error: idValidation.error }, 400);

    const prayerId = idValidation.data;

    await db
      .delete(prayerJoins)
      .where(and(eq(prayerJoins.prayerRequestId, prayerId), eq(prayerJoins.userId, user.id)));

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error leaving prayer join:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

verseRoutes.put('/prayers/:id/answered', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const idValidation = validateUuid(c.req.param('id'), 'id');
    if (!idValidation.ok) return c.json({ error: idValidation.error }, 400);

    const [prayer] = await db
      .update(prayerRequests)
      .set({ status: 'answered', answeredAt: new Date() })
      .where(and(eq(prayerRequests.id, idValidation.data), eq(prayerRequests.userId, user.id)))
      .returning();

    if (!prayer) return c.json({ error: 'Prayer request not found' }, 404);
    return c.json({ prayer });
  } catch (err: any) {
    console.error('Error updating prayer request:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /verses/search?q=... — Semantically search cached verses.
 */
verseRoutes.get('/verses/search', createRateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'verses-search' }), async (c) => {
  try {
    const validation = validateSearchQuery(c.req.query('q'));
    if (!validation.ok) return c.json({ error: validation.error }, 400);
    const query = validation.data;

    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await getEmbedding(query);
    } catch (err) {
      console.warn('⚠️ Embedding calculation failed, falling back to local database text search:', err);
    }

    if (!queryEmbedding) {
      // Keyword fallback, done in SQL. The cache holds ~30k verses, so pulling
      // them all into Node on every search is far too slow (and memory-heavy on
      // small instances). Score = share of query words found in the verse.
      const queryWords = [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 10);
      if (queryWords.length === 0) return c.json({ matches: [] });

      const patterns = queryWords.map((word) => `%${word.replace(/[\\%_]/g, '\\$&')}%`);
      const matchCount = sql<number>`(${sql.join(
        patterns.map((pattern) => sql`(${bibleVerses.text} ilike ${pattern})::int`),
        sql` + `,
      )})`;

      const rows = await db
        .select({
          id: bibleVerses.id,
          text: bibleVerses.text,
          chapter: bibleVerses.chapter,
          verseNumber: bibleVerses.verseNumber,
          translation: bibleVerses.translation,
          bookName: bibleBooks.name,
          bookAbbreviation: bibleBooks.abbreviation,
          matchCount,
        })
        .from(bibleVerses)
        .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id))
        .where(or(...patterns.map((pattern) => ilike(bibleVerses.text, pattern))))
        .orderBy(desc(matchCount), asc(bibleVerses.id))
        .limit(6);

      const matches = rows.map((row) => ({
        verse: {
          id: row.id,
          text: row.text,
          chapter: row.chapter,
          verseNumber: row.verseNumber,
          translation: row.translation,
        },
        book: {
          name: row.bookName,
          abbreviation: row.bookAbbreviation,
        },
        score: Number(row.matchCount) / queryWords.length,
      }));

      return c.json({ matches });
    }

    // Semantic path: needs every verse's embedding to rank by cosine similarity.
    const allVerses = await db
      .select({
        id: bibleVerses.id,
        text: bibleVerses.text,
        chapter: bibleVerses.chapter,
        verseNumber: bibleVerses.verseNumber,
        translation: bibleVerses.translation,
        embedding: bibleVerses.embedding,
        bookName: bibleBooks.name,
        bookAbbreviation: bibleBooks.abbreviation,
      })
      .from(bibleVerses)
      .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id));

    const matches: any[] = [];

    for (const row of allVerses) {
      let embedding = row.embedding as number[] | null;
      if (!embedding) {
        try {
          embedding = await getEmbedding(row.text);
          await db.update(bibleVerses).set({ embedding }).where(eq(bibleVerses.id, row.id));
        } catch (e) {
          console.error(`Failed to generate missing embedding for search on verse ${row.id}:`, e);
          continue;
        }
      }

      const score = cosineSimilarity(queryEmbedding, embedding);
      matches.push({
        verse: {
          id: row.id,
          text: row.text,
          chapter: row.chapter,
          verseNumber: row.verseNumber,
          translation: row.translation,
        },
        book: {
          name: row.bookName,
          abbreviation: row.bookAbbreviation,
        },
        score,
      });
    }

    // Sort by cosine similarity score descending
    matches.sort((a, b) => b.score - a.score);

    // Return top 6 matches
    return c.json({ matches: matches.slice(0, 6) });
  } catch (err: any) {
    console.error('Error performing semantic search:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /verses/:id/related — Return top 3 semantically related scriptures.
 */
verseRoutes.get('/verses/:id/related', async (c) => {
  try {
    const verseId = parseInt(c.req.param('id'), 10);
    if (!Number.isSafeInteger(verseId) || verseId < 1) {
      return c.json({ error: 'Invalid verse ID' }, 400);
    }

    // 1. Fetch the target verse
    const targetRows = await db
      .select({
        id: bibleVerses.id,
        text: bibleVerses.text,
        embedding: bibleVerses.embedding,
      })
      .from(bibleVerses)
      .where(eq(bibleVerses.id, verseId))
      .limit(1);

    if (targetRows.length === 0) {
      return c.json({ error: 'Verse not found' }, 404);
    }

    const target = targetRows[0];
    let targetEmbedding = target.embedding as number[] | null;
    let fallbackToTextSearch = false;

    if (!targetEmbedding) {
      try {
        targetEmbedding = await getEmbedding(target.text);
        await db.update(bibleVerses).set({ embedding: targetEmbedding }).where(eq(bibleVerses.id, target.id));
      } catch (e) {
        console.warn(`⚠️ Target embedding generation failed for related verses on ${target.id}:`, e);
        fallbackToTextSearch = true;
      }
    }

    // 2. Fetch all other cached verses
    const otherVerses = await db
      .select({
        id: bibleVerses.id,
        text: bibleVerses.text,
        chapter: bibleVerses.chapter,
        verseNumber: bibleVerses.verseNumber,
        translation: bibleVerses.translation,
        embedding: bibleVerses.embedding,
        bookName: bibleBooks.name,
        bookAbbreviation: bibleBooks.abbreviation,
      })
      .from(bibleVerses)
      .innerJoin(bibleBooks, eq(bibleVerses.bookId, bibleBooks.id));

    if (fallbackToTextSearch || !targetEmbedding) {
      // Fallback: recommend verses from the same book or sharing common words
      const targetWords = target.text.toLowerCase().split(/\s+/).filter(Boolean);
      const recommendations = otherVerses
        .filter((row) => row.id !== target.id)
        .map((row) => {
          const textLower = row.text.toLowerCase();
          let matchCount = 0;
          targetWords.forEach((word) => {
            if (textLower.includes(word)) matchCount++;
          });
          const score = targetWords.length > 0 ? matchCount / targetWords.length : 0;
          return {
            verse: {
              id: row.id,
              text: row.text,
              chapter: row.chapter,
              verseNumber: row.verseNumber,
              translation: row.translation,
            },
            book: {
              name: row.bookName,
              abbreviation: row.bookAbbreviation,
            },
            score,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return c.json({ related: recommendations });
    }

    const recommendations: any[] = [];

    for (const row of otherVerses) {
      if (row.id === target.id) continue;

      let embedding = row.embedding as number[] | null;
      if (!embedding) {
        try {
          embedding = await getEmbedding(row.text);
          await db.update(bibleVerses).set({ embedding }).where(eq(bibleVerses.id, row.id));
        } catch (e) {
          continue;
        }
      }

      const score = cosineSimilarity(targetEmbedding, embedding);
      recommendations.push({
        verse: {
          id: row.id,
          text: row.text,
          chapter: row.chapter,
          verseNumber: row.verseNumber,
          translation: row.translation,
        },
        book: {
          name: row.bookName,
          abbreviation: row.bookAbbreviation,
        },
        score,
      });
    }

    // Sort and return top 3
    recommendations.sort((a, b) => b.score - a.score);
    return c.json({ related: recommendations.slice(0, 3) });
  } catch (err: any) {
    console.error('Error fetching related verses:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
