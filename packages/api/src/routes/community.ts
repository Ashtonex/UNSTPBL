import { Hono } from 'hono';
import { db } from '../lib/db.js';
import {
  circles,
  userCircles,
  sermons,
  userSermonNotes,
  triviaQuestions,
  userTriviaResponses,
  verseReadings,
  eq,
  and,
  count,
  desc,
  gte,
} from '@unstpbl/db';
import { authMiddleware } from '../middleware/auth.js';
import { bishopMiddleware } from '../middleware/bishop.js';
import { validateUuid } from '../lib/validation.js';

export const communityRoutes = new Hono();

// Apply auth to all community routes
communityRoutes.use('*', authMiddleware);

// ── 1. Circles (Home/Cell Groups) ──────────────────────────────────────────

/**
 * GET /circles — Get all family circles and user's joined status.
 */
communityRoutes.get('/circles', async (c) => {
  try {
    const user = c.get('user');
    const allCircles = await db.select().from(circles).orderBy(circles.name);
    const joined = await db
      .select({ circleId: userCircles.circleId })
      .from(userCircles)
      .where(eq(userCircles.userId, user.id));

    const joinedSet = new Set(joined.map((jc) => jc.circleId));

    const formatted = allCircles.map((circle) => ({
      ...circle,
      hasJoined: joinedSet.has(circle.id),
    }));

    return c.json({ circles: formatted });
  } catch (err: any) {
    console.error('Error fetching circles:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /circles — Create a new circle (Bishop/Admin only).
 */
communityRoutes.post('/circles', bishopMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();

    if (!name) return c.json({ error: 'Circle name is required' }, 400);

    const [newCircle] = await db
      .insert(circles)
      .values({ name, description })
      .returning();

    return c.json({ circle: newCircle });
  } catch (err: any) {
    console.error('Error creating circle:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /circles/:id/join — Join a circle.
 */
communityRoutes.post('/circles/:id/join', async (c) => {
  try {
    const user = c.get('user');
    const circleId = c.req.param('id');
    const idValidation = validateUuid(circleId, 'circleId');
    if (!idValidation.ok) return c.json({ error: idValidation.error }, 400);

    // Verify circle exists
    const match = await db.select().from(circles).where(eq(circles.id, circleId)).limit(1);
    if (match.length === 0) return c.json({ error: 'Circle not found' }, 404);

    await db
      .insert(userCircles)
      .values({ userId: user.id, circleId })
      .onConflictDoNothing();

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error joining circle:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * DELETE /circles/:id/join — Leave a circle.
 */
communityRoutes.delete('/circles/:id/join', async (c) => {
  try {
    const user = c.get('user');
    const circleId = c.req.param('id');
    const idValidation = validateUuid(circleId, 'circleId');
    if (!idValidation.ok) return c.json({ error: idValidation.error }, 400);

    await db
      .delete(userCircles)
      .where(and(eq(userCircles.circleId, circleId), eq(userCircles.userId, user.id)));

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error leaving circle:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ── 2. Sermons & Sermon Notes ──────────────────────────────────────────────

/**
 * GET /sermons — List all sermons.
 */
communityRoutes.get('/sermons', async (c) => {
  try {
    const allSermons = await db.select().from(sermons).orderBy(desc(sermons.date));
    return c.json({ sermons: allSermons });
  } catch (err: any) {
    console.error('Error fetching sermons:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /sermons — Create a new sermon outline (Bishop/Admin only).
 */
communityRoutes.post('/sermons', bishopMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const title = String(body.title || '').trim();
    const preacher = String(body.preacher || '').trim();
    const date = String(body.date || '').trim();
    const outline = String(body.outline || '').trim();

    if (!title || !preacher || !date || !outline) {
      return c.json({ error: 'Title, preacher, date, and outline are required' }, 400);
    }

    const [newSermon] = await db
      .insert(sermons)
      .values({ title, preacher, date, outline })
      .returning();

    return c.json({ sermon: newSermon });
  } catch (err: any) {
    console.error('Error creating sermon:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * GET /sermons/:id/notes — Get personal notes for a sermon.
 */
communityRoutes.get('/sermons/:id/notes', async (c) => {
  try {
    const user = c.get('user');
    const sermonId = c.req.param('id');
    const idValidation = validateUuid(sermonId, 'sermonId');
    if (!idValidation.ok) return c.json({ error: idValidation.error }, 400);

    const match = await db
      .select()
      .from(userSermonNotes)
      .where(and(eq(userSermonNotes.sermonId, sermonId), eq(userSermonNotes.userId, user.id)))
      .limit(1);

    return c.json({ notes: match[0]?.notes || '' });
  } catch (err: any) {
    console.error('Error fetching sermon notes:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * PUT /sermons/:id/notes — Save/update personal notes.
 */
communityRoutes.put('/sermons/:id/notes', async (c) => {
  try {
    const user = c.get('user');
    const sermonId = c.req.param('id');
    const idValidation = validateUuid(sermonId, 'sermonId');
    if (!idValidation.ok) return c.json({ error: idValidation.error }, 400);

    const body = await c.req.json();
    const notes = String(body.notes || '').trim();

    const existing = await db
      .select()
      .from(userSermonNotes)
      .where(and(eq(userSermonNotes.sermonId, sermonId), eq(userSermonNotes.userId, user.id)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userSermonNotes)
        .set({ notes, updatedAt: new Date() })
        .where(eq(userSermonNotes.id, existing[0].id));
    } else {
      await db.insert(userSermonNotes).values({
        userId: user.id,
        sermonId,
        notes,
      });
    }

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error updating sermon notes:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ── 3. Weekly Trivia ────────────────────────────────────────────────────────

/**
 * GET /trivia/weekly — Get trivia questions for this week.
 */
communityRoutes.get('/trivia/weekly', async (c) => {
  try {
    const user = c.get('user');

    // Get the Monday of current week
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(now.setDate(diff));
    const mondayStr = monday.toISOString().split('T')[0];

    const questions = await db
      .select()
      .from(triviaQuestions)
      .where(eq(triviaQuestions.weekDate, mondayStr));

    const responses = await db
      .select()
      .from(userTriviaResponses)
      .where(eq(userTriviaResponses.userId, user.id));

    const responseMap = new Set(responses.map((r) => r.questionId));
    const responseDetailMap = new Map(responses.map((r) => [r.questionId, r]));

    const formatted = questions.map((q) => {
      const resp = responseDetailMap.get(q.id);
      return {
        id: q.id,
        question: q.question,
        options: q.options as string[],
        explanation: resp ? q.explanation : null, // only return explanation if they answered
        correctOptionIndex: resp ? q.correctOptionIndex : -1, // only return correct answer index if answered
        weekDate: q.weekDate,
        createdAt: q.createdAt,
        hasAnswered: responseMap.has(q.id),
        selectedOptionIndex: resp ? resp.selectedOptionIndex : undefined,
        isCorrect: resp ? resp.isCorrect : undefined,
      };
    });

    return c.json({ trivia: formatted });
  } catch (err: any) {
    console.error('Error fetching trivia questions:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /trivia/submit — Submit trivia response.
 */
communityRoutes.post('/trivia/submit', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { questionId, selectedOptionIndex } = body;

    const idValidation = validateUuid(questionId, 'questionId');
    if (!idValidation.ok) return c.json({ error: idValidation.error }, 400);

    const idx = parseInt(selectedOptionIndex, 10);
    if (!Number.isInteger(idx) || idx < 0) {
      return c.json({ error: 'selectedOptionIndex must be a non-negative integer' }, 400);
    }

    // Verify question exists
    const qMatch = await db
      .select()
      .from(triviaQuestions)
      .where(eq(triviaQuestions.id, questionId))
      .limit(1);

    if (qMatch.length === 0) return c.json({ error: 'Trivia question not found' }, 404);
    const question = qMatch[0];

    const isCorrect = question.correctOptionIndex === idx;

    await db
      .insert(userTriviaResponses)
      .values({
        userId: user.id,
        questionId,
        selectedOptionIndex: idx,
        isCorrect,
      });

    return c.json({
      success: true,
      isCorrect,
      correctOptionIndex: question.correctOptionIndex,
      explanation: question.explanation,
    });
  } catch (err: any) {
    console.error('Error submitting trivia answer:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

/**
 * POST /admin/trivia — Add a new trivia question (Bishop/Admin only).
 */
communityRoutes.post('/admin/trivia', bishopMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { question, options, correctOptionIndex, explanation, weekDate } = body;

    if (!question || !Array.isArray(options) || options.length < 2 || !Number.isInteger(correctOptionIndex) || !weekDate) {
      return c.json({ error: 'Question, options (at least 2), correctOptionIndex, and weekDate are required' }, 400);
    }

    const [newQuestion] = await db
      .insert(triviaQuestions)
      .values({
        question,
        options,
        correctOptionIndex,
        explanation,
        weekDate,
      })
      .returning();

    return c.json({ trivia: newQuestion });
  } catch (err: any) {
    console.error('Error creating trivia question:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// ── 4. Collective Congregation Milestones ─────────────────────────────────

/**
 * GET /stats/milestones — Return monthly collective readings count and achievements.
 */
communityRoutes.get('/stats/milestones', async (c) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);

    const totalReadingsResult = await db
      .select({ val: count() })
      .from(verseReadings)
      .where(gte(verseReadings.readAt, startOfMonth));

    const totalReads = totalReadingsResult[0]?.val ?? 0;

    // Defined milestones for the church family
    const milestones = [
      { target: 100, label: 'Small Family Gathering', desc: '100 scriptures read collectively this month.' },
      { target: 500, label: 'Faithful Fellowship', desc: '500 scriptures read collectively this month.' },
      { target: 1000, label: 'Victory Walkers', desc: '1,000 scriptures read collectively this month.' },
      { target: 2000, label: 'Unstoppable Faith', desc: '2,000 scriptures read collectively this month.' },
    ];

    const formattedMilestones = milestones.map((m) => ({
      ...m,
      achieved: totalReads >= m.target,
    }));

    return c.json({
      totalReads,
      milestones: formattedMilestones,
    });
  } catch (err: any) {
    console.error('Error fetching milestones:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});
