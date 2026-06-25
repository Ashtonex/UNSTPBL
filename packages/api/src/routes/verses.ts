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
import { getEmbedding, cosineSimilarity } from '../lib/embeddings.js';

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

/**
 * GET /verses/search?q=... — Semantically search cached verses.
 */
verseRoutes.get('/verses/search', async (c) => {
  try {
    const query = c.req.query('q');
    if (!query) {
      return c.json({ error: 'Search query parameter "q" is required' }, 400);
    }

    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await getEmbedding(query);
    } catch (err) {
      console.warn('⚠️ Embedding calculation failed, falling back to local database text search:', err);
    }

    // Fetch all cached verses
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

    if (!queryEmbedding) {
      // Fallback: keyword matching case-insensitive search
      const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
      const matches = allVerses
        .map((row) => {
          const textLower = row.text.toLowerCase();
          let matchCount = 0;
          queryWords.forEach((word) => {
            if (textLower.includes(word)) {
              matchCount++;
            }
          });
          const score = queryWords.length > 0 ? matchCount / queryWords.length : 0;
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
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

      return c.json({ matches });
    }

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
    if (isNaN(verseId)) {
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
