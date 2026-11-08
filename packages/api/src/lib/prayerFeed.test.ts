import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  and,
  count,
  desc,
  eq,
  prayerJoins,
  prayerRequests,
  users,
  type Database,
} from '@unstpbl/db';
import * as schema from '@unstpbl/db';
import { formatPrayerFeed, loadPrayerFeed, PRAYER_FEED_LIMIT, type PrayerRow } from './prayerFeed.js';

/**
 * These tests run the real queries against a real Postgres (PGlite, in-process, no Docker needed).
 * The tables below are written by hand, with the same column names as packages/db/src/schema.ts
 * (the circles table is left out, so circle_id has no foreign key here). If a column is renamed there,
 * these tests fail here too.
 */
const DDL = `
  CREATE TYPE user_role AS ENUM ('member','usher','pastor','communications','bishop','admin');
  CREATE TYPE prayer_status AS ENUM ('open','answered');
  CREATE TABLE users (
    id uuid PRIMARY KEY,
    email varchar(255) NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'member',
    display_name varchar(255),
    congregation varchar(255),
    translation varchar(10) NOT NULL DEFAULT 'KJV',
    bio text,
    phone varchar(40),
    location varchar(120),
    birthday date,
    birthday_visibility varchar(20) NOT NULL DEFAULT 'members',
    avatar_url text,
    push_subscription jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE prayer_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    title varchar(120) NOT NULL,
    content text NOT NULL,
    status prayer_status NOT NULL DEFAULT 'open',
    type varchar(20) NOT NULL DEFAULT 'request',
    is_anonymous boolean NOT NULL DEFAULT false,
    circle_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    answered_at timestamptz
  );
  CREATE TABLE prayer_joins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    prayer_request_id uuid NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX prayer_joins_user_request_idx ON prayer_joins (user_id, prayer_request_id);
`;

const ALICE = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';
const CAROL = '00000000-0000-4000-8000-00000000000c';
const STRANGER = '00000000-0000-4000-8000-0000000000ff';

let client: PGlite;
let db: Database;
let queryCount = 0;

/** The old route logic, kept here as the reference the new code must agree with. */
async function legacyFeed(currentUserId: string) {
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

  return Promise.all(
    allPrayers.map(async (prayer) => {
      const joinCountResult = await db
        .select({ val: count() })
        .from(prayerJoins)
        .where(eq(prayerJoins.prayerRequestId, prayer.id));
      const userJoin = await db
        .select()
        .from(prayerJoins)
        .where(and(eq(prayerJoins.prayerRequestId, prayer.id), eq(prayerJoins.userId, currentUserId)))
        .limit(1);
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
        user: prayer.isAnonymous
          ? { displayName: 'Anonymous Member', congregation: null }
          : { displayName: prayer.authorName || 'Family Member', congregation: prayer.authorCongregation },
        _count: { joins: joinCountResult[0]?.val ?? 0 },
        hasJoined: userJoin.length > 0,
      };
    }),
  );
}

async function seedPrayer(
  userId: string,
  title: string,
  minutesAgo: number,
  extra: Partial<{ isAnonymous: boolean; type: string; status: 'open' | 'answered' }> = {},
) {
  const [row] = await db
    .insert(prayerRequests)
    .values({
      userId,
      title,
      content: `${title} content`,
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
      ...extra,
    })
    .returning();
  return row!;
}

const join = (userId: string, prayerRequestId: string) => db.insert(prayerJoins).values({ userId, prayerRequestId });

beforeAll(async () => {
  client = new PGlite();
  await client.exec(DDL);
  db = drizzle(client, {
    schema,
    logger: { logQuery: () => void queryCount++ },
  }) as unknown as Database;

  await db.insert(users).values([
    { id: ALICE, email: 'alice@example.test', displayName: 'Alice', congregation: 'Mutare Central' },
    { id: BOB, email: 'bob@example.test', displayName: null, congregation: null }, // no display name
    { id: CAROL, email: 'carol@example.test', displayName: 'Carol', congregation: 'Chikanga' },
  ]);

  const p1 = await seedPrayer(ALICE, 'Healing for my mother', 50);
  const p2 = await seedPrayer(BOB, 'Praise for a new job', 40, { type: 'praise' });
  const p3 = await seedPrayer(CAROL, 'Quiet request', 30, { isAnonymous: true });
  const p4 = await seedPrayer(ALICE, 'Answered: exam results', 20, { status: 'answered' });
  await seedPrayer(CAROL, 'Nobody has joined this one', 10);

  await join(ALICE, p1.id);
  await join(BOB, p1.id);
  await join(CAROL, p1.id);
  await join(ALICE, p2.id);
  await join(BOB, p3.id);
  await join(ALICE, p4.id);
}, 60_000);

afterAll(async () => {
  await client.close();
});

describe('loadPrayerFeed', () => {
  it('returns exactly what the old per-prayer logic returned, for every viewer', async () => {
    for (const viewer of [ALICE, BOB, CAROL, STRANGER]) {
      const fresh = await loadPrayerFeed(db, viewer);
      const legacy = await legacyFeed(viewer);
      expect(fresh).toEqual(legacy);
    }
  });

  it('lists the newest prayers first', async () => {
    const feed = await loadPrayerFeed(db, ALICE);
    expect(feed.map((p) => p.title)).toEqual([
      'Nobody has joined this one',
      'Answered: exam results',
      'Quiet request',
      'Praise for a new job',
      'Healing for my mother',
    ]);
  });

  it('counts joins and knows which prayers the viewer joined', async () => {
    const byTitle = (feed: Awaited<ReturnType<typeof loadPrayerFeed>>, title: string) =>
      feed.find((p) => p.title === title)!;

    const alice = await loadPrayerFeed(db, ALICE);
    expect(byTitle(alice, 'Healing for my mother')).toMatchObject({ _count: { joins: 3 }, hasJoined: true });
    expect(byTitle(alice, 'Quiet request')).toMatchObject({ _count: { joins: 1 }, hasJoined: false });
    expect(byTitle(alice, 'Nobody has joined this one')).toMatchObject({ _count: { joins: 0 }, hasJoined: false });

    const stranger = await loadPrayerFeed(db, STRANGER);
    expect(stranger.every((p) => p.hasJoined === false)).toBe(true);
    expect(byTitle(stranger, 'Healing for my mother')._count.joins).toBe(3);
  });

  it('hides the author of an anonymous prayer and names members who have no display name', async () => {
    const feed = await loadPrayerFeed(db, ALICE);
    const anonymous = feed.find((p) => p.title === 'Quiet request')!;
    expect(anonymous.user).toEqual({ displayName: 'Anonymous Member', congregation: null });
    expect(anonymous.isAnonymous).toBe(true);

    const noName = feed.find((p) => p.title === 'Praise for a new job')!;
    expect(noName.user).toEqual({ displayName: 'Family Member', congregation: null });
    expect(noName.type).toBe('praise');
  });

  it('uses three queries however many prayers there are', async () => {
    queryCount = 0;
    await loadPrayerFeed(db, ALICE);
    expect(queryCount).toBe(3);

    // Add a lot more prayers and joins: the number of queries must not grow.
    for (let i = 0; i < 60; i++) {
      const prayer = await seedPrayer(ALICE, `Bulk prayer ${i}`, 1000 + i);
      await join(BOB, prayer.id);
    }
    queryCount = 0;
    const feed = await loadPrayerFeed(db, BOB);
    expect(queryCount).toBe(3);
    expect(feed.length).toBe(65);

    // Past the wall's limit it still stops at the limit, still in three queries.
    for (let i = 0; i < PRAYER_FEED_LIMIT; i++) await seedPrayer(CAROL, `Overflow prayer ${i}`, 5000 + i);
    queryCount = 0;
    expect((await loadPrayerFeed(db, BOB)).length).toBe(PRAYER_FEED_LIMIT);
    expect(queryCount).toBe(3);

    // A zero limit asks for nothing and must not fall through to "everything".
    queryCount = 0;
    expect(await loadPrayerFeed(db, BOB, 0)).toEqual([]);
    expect(queryCount).toBe(0);
  });

  it('uses a single query when the wall is empty', async () => {
    const emptyClient = new PGlite();
    try {
      await emptyClient.exec(DDL);
      let queries = 0;
      const emptyDb = drizzle(emptyClient, {
        schema,
        logger: { logQuery: () => void queries++ },
      }) as unknown as Database;

      expect(await loadPrayerFeed(emptyDb, ALICE)).toEqual([]);
      expect(queries).toBe(1);
    } finally {
      await emptyClient.close();
    }
  }, 30_000);

  it('respects the limit, keeping the newest prayers', async () => {
    const feed = await loadPrayerFeed(db, ALICE, 2);
    expect(feed.map((p) => p.title)).toEqual(['Nobody has joined this one', 'Answered: exam results']);
  });
});

describe('formatPrayerFeed', () => {
  const row: PrayerRow = {
    id: 'p1',
    userId: 'u1',
    title: 't',
    content: 'c',
    status: 'open',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    answeredAt: null,
    type: null,
    isAnonymous: null,
    authorName: null,
    authorCongregation: null,
  };

  it('fills in defaults for missing type, anonymity and author name', () => {
    const [item] = formatPrayerFeed([row], new Map(), new Set());
    expect(item).toMatchObject({
      type: 'request',
      isAnonymous: false,
      user: { displayName: 'Family Member', congregation: null },
      _count: { joins: 0 },
      hasJoined: false,
    });
  });
});
