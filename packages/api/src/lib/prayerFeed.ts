import {
  and,
  count,
  desc,
  eq,
  inArray,
  prayerJoins,
  prayerRequests,
  users,
  type Database,
} from '@unstpbl/db';

/** One prayer as the Prayer Wall shows it. (Mirrors `PrayerRequest` in @unstpbl/shared.) */
export interface PrayerFeedItem {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: 'open' | 'answered';
  type: string;
  isAnonymous: boolean;
  createdAt: Date;
  answeredAt: Date | null;
  user: { displayName: string | null; congregation: string | null };
  _count: { joins: number };
  hasJoined: boolean;
}

/** Newest prayers shown on the wall. */
export const PRAYER_FEED_LIMIT = 100;

/**
 * The Prayer Wall: the newest prayers, with how many people joined each and whether `currentUserId`
 * is one of them.
 *
 * This is always THREE database queries, however many prayers there are. It used to run two extra
 * queries per prayer (a join count and a "did I join" lookup), so a full wall of 100 prayers cost
 * about 200 queries on every load.
 */
export async function loadPrayerFeed(
  db: Database,
  currentUserId: string,
  limit: number = PRAYER_FEED_LIMIT,
): Promise<PrayerFeedItem[]> {
  // (Drizzle treats limit(0) as "no limit", which would return the whole table.)
  if (limit <= 0) return [];

  // 1. The prayers themselves, with their author.
  const prayers = await db
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
    .limit(limit);

  if (prayers.length === 0) return [];
  const prayerIds = prayers.map((prayer) => prayer.id);

  // 2. How many people joined each of those prayers.
  const joinCounts = await db
    .select({ prayerRequestId: prayerJoins.prayerRequestId, joins: count() })
    .from(prayerJoins)
    .where(inArray(prayerJoins.prayerRequestId, prayerIds))
    .groupBy(prayerJoins.prayerRequestId);

  // 3. Which of them the current person joined.
  const mine = await db
    .select({ prayerRequestId: prayerJoins.prayerRequestId })
    .from(prayerJoins)
    .where(and(eq(prayerJoins.userId, currentUserId), inArray(prayerJoins.prayerRequestId, prayerIds)));

  return formatPrayerFeed(
    prayers,
    new Map(joinCounts.map((row) => [row.prayerRequestId, Number(row.joins)])),
    new Set(mine.map((row) => row.prayerRequestId)),
  );
}

/** A prayer row as selected from the database, before shaping. */
export interface PrayerRow {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: 'open' | 'answered';
  createdAt: Date;
  answeredAt: Date | null;
  type: string | null;
  isAnonymous: boolean | null;
  authorName: string | null;
  authorCongregation: string | null;
}

/** Pure shaping step, kept separate so the rules for anonymous prayers are easy to test. */
export function formatPrayerFeed(
  prayers: PrayerRow[],
  joinCounts: ReadonlyMap<string, number>,
  joinedByMe: ReadonlySet<string>,
): PrayerFeedItem[] {
  return prayers.map((prayer) => ({
    id: prayer.id,
    userId: prayer.userId,
    title: prayer.title,
    content: prayer.content,
    status: prayer.status,
    createdAt: prayer.createdAt,
    answeredAt: prayer.answeredAt,
    type: prayer.type || 'request',
    isAnonymous: prayer.isAnonymous || false,
    // An anonymous prayer never reveals who wrote it.
    user: prayer.isAnonymous
      ? { displayName: 'Anonymous Member', congregation: null }
      : {
          displayName: prayer.authorName || 'Family Member',
          congregation: prayer.authorCongregation,
        },
    _count: { joins: joinCounts.get(prayer.id) ?? 0 },
    hasJoined: joinedByMe.has(prayer.id),
  }));
}
