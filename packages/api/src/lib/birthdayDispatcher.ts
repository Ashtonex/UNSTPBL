import { and, desc, eq, sql } from '@unstpbl/db';
import { birthdayWallPosts, users } from '@unstpbl/db';
import { db } from './db.js';
import { sendPushToSubscribers } from './pushDispatcher.js';
import { sendBirthdayGreeting } from './sms/memberMessages.js';
import { defaultSmsDeps } from './sms/store.js';

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthDay(value: Date) {
  return value.toISOString().slice(5, 10);
}

function displayName(user: { displayName: string | null; email: string }) {
  return user.displayName?.trim() || user.email.split('@')[0] || 'A church family member';
}

function buildBirthdayMessage(name: string) {
  return `Happy birthday, ${name}. May this new year be filled with grace, strength, and fresh testimony.`;
}

export async function dispatchTodaysBirthdayAnnouncements(now = new Date()) {
  const today = toDateKey(now);
  const todayMonthDay = monthDay(now);
  const year = now.getUTCFullYear();

  const birthdayUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      congregation: users.congregation,
      avatarUrl: users.avatarUrl,
      birthday: users.birthday,
    })
    .from(users)
    .where(
      and(
        sql`to_char(${users.birthday}, 'MM-DD') = ${todayMonthDay}`,
        eq(users.birthdayVisibility, 'members'),
      ),
    );

  let created = 0;
  let sent = 0;
  let failed = 0;

  for (const birthdayUser of birthdayUsers) {
    const name = displayName(birthdayUser);
    const message = buildBirthdayMessage(name);

    const [post] = await db
      .insert(birthdayWallPosts)
      .values({
        userId: birthdayUser.id,
        birthdayDate: today,
        birthdayYear: year,
        message,
      })
      .onConflictDoNothing({
        target: [birthdayWallPosts.userId, birthdayWallPosts.birthdayYear],
      })
      .returning();

    if (!post) continue;

    created += 1;

    // The wall post above exists at most once per person per year, so this greeting is
    // sent at most once too. It only goes to members who opted in to birthday texts, and
    // a failure here must never stop the push announcements below.
    try {
      await sendBirthdayGreeting(db, defaultSmsDeps(), birthdayUser.id);
    } catch (err) {
      console.error('Birthday SMS failed:', err);
    }
    const result = await sendPushToSubscribers({
      title: `Today is ${name}'s birthday`,
      body: 'Open the birthday wall and send a blessing.',
      url: '/birthdays',
      excludeUserIds: [birthdayUser.id],
    });

    sent += result.sent;
    failed += result.failed;
  }

  return {
    processed: birthdayUsers.length,
    created,
    sent,
    failed,
  };
}

export async function getBirthdayWall(limit = 30) {
  const rows = await db
    .select({
      id: birthdayWallPosts.id,
      userId: birthdayWallPosts.userId,
      birthdayDate: birthdayWallPosts.birthdayDate,
      birthdayYear: birthdayWallPosts.birthdayYear,
      message: birthdayWallPosts.message,
      createdAt: birthdayWallPosts.createdAt,
      displayName: users.displayName,
      congregation: users.congregation,
      avatarUrl: users.avatarUrl,
    })
    .from(birthdayWallPosts)
    .innerJoin(users, eq(birthdayWallPosts.userId, users.id))
    .orderBy(desc(birthdayWallPosts.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    birthdayDate: row.birthdayDate,
    birthdayYear: row.birthdayYear,
    message: row.message,
    createdAt: row.createdAt,
    user: {
      id: row.userId,
      displayName: row.displayName,
      congregation: row.congregation,
      avatarUrl: row.avatarUrl,
    },
  }));
}

export async function getUpcomingBirthdays(now = new Date(), days = 30) {
  const today = toDateKey(now);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + days);
  const endKey = toDateKey(end);
  const year = now.getUTCFullYear();

  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      congregation: users.congregation,
      avatarUrl: users.avatarUrl,
      birthday: users.birthday,
    })
    .from(users)
    .where(
      and(
        eq(users.birthdayVisibility, 'members'),
        sql`${users.birthday} IS NOT NULL`,
      ),
    );

  return rows
    .map((row) => {
      const birthday = row.birthday as string | null;
      if (!birthday) return null;

      const [, month, day] = birthday.split('-');
      let nextBirthday = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      if (toDateKey(nextBirthday) < today) {
        nextBirthday = new Date(`${year + 1}-${month}-${day}T00:00:00.000Z`);
      }

      const nextBirthdayKey = toDateKey(nextBirthday);
      if (nextBirthdayKey > endKey) return null;

      const daysUntil = Math.round((nextBirthday.getTime() - new Date(`${today}T00:00:00.000Z`).getTime()) / 86_400_000);

      return {
        userId: row.userId,
        displayName: row.displayName,
        congregation: row.congregation,
        avatarUrl: row.avatarUrl,
        birthday: nextBirthdayKey,
        daysUntil,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.daysUntil - b.daysUntil || (a.displayName || '').localeCompare(b.displayName || ''));
}
