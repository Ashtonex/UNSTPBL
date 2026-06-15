import { Hono } from 'hono';
import { DEFAULT_FALLBACK_VERSE } from '@unstpbl/shared';

export const verseRoutes = new Hono();

/**
 * GET /verses/today — Returns today's scheduled verse.
 * Phase 1: Returns mock/fallback data.
 * Phase 2: Will query verse_schedule joined with bible_verses for today's date.
 */
verseRoutes.get('/verses/today', (c) => {
  const today = new Date().toISOString().split('T')[0];

  return c.json({
    schedule: {
      id: '00000000-0000-0000-0000-000000000000',
      date: today,
      verseId: 1,
      mode: 'manual',
    },
    verse: {
      id: 1,
      bookId: 19,
      chapter: DEFAULT_FALLBACK_VERSE.chapter,
      verseNumber: DEFAULT_FALLBACK_VERSE.verseNumber,
      text: DEFAULT_FALLBACK_VERSE.text,
      translation: DEFAULT_FALLBACK_VERSE.translation,
    },
    book: {
      id: 19,
      name: DEFAULT_FALLBACK_VERSE.book,
      abbreviation: 'Ps',
      testament: 'old',
    },
  });
});

/**
 * GET /verses/history — Returns last N days of verses.
 * Phase 1: Stub returning empty array.
 */
verseRoutes.get('/verses/history', (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);
  return c.json({ verses: [], days });
});
