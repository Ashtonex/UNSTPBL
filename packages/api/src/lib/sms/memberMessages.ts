import { and, eq, gte, inArray, messageLog, smsConsents, smsOptOuts, users, type Database } from '@unstpbl/db';
import { cleanVerseText } from '@unstpbl/shared';
import { normalizePhone } from './phone.js';
import { sendSms, type SmsDeps } from './service.js';
import { birthdayGreetingMessage, dailyVerseMessage } from './templates.js';

export interface SmsPreferences {
  announcements: boolean;
  dailyVerse: boolean;
  birthday: boolean;
}

export interface SmsPreferencesView extends SmsPreferences {
  /** The number on the member's profile as saved, or null. */
  phone: string | null;
  /** Whether that number can actually receive texts. Preferences are useless without it. */
  phoneUsable: boolean;
  /** The number replied STOP; texts stay off until they reply START. */
  optedOut: boolean;
}

const OFF: SmsPreferences = { announcements: false, dailyVerse: false, birthday: false };

export async function getSmsPreferences(database: Database, userId: string): Promise<SmsPreferencesView> {
  const [user] = await database.select({ phone: users.phone }).from(users).where(eq(users.id, userId)).limit(1);
  const [consent] = await database.select().from(smsConsents).where(eq(smsConsents.userId, userId)).limit(1);

  const phone = normalizePhone(user?.phone ?? '');
  let optedOut = false;
  if (phone.ok) {
    optedOut = (await database.select({ phone: smsOptOuts.phone }).from(smsOptOuts).where(eq(smsOptOuts.phone, phone.e164)).limit(1)).length > 0;
  }

  return {
    announcements: consent?.announcements ?? false,
    dailyVerse: consent?.dailyVerse ?? false,
    birthday: consent?.birthday ?? false,
    phone: user?.phone ?? null,
    phoneUsable: phone.ok,
    optedOut,
  };
}

export async function saveSmsPreferences(database: Database, userId: string, preferences: SmsPreferences): Promise<void> {
  await database
    .insert(smsConsents)
    .values({ userId, ...preferences })
    .onConflictDoUpdate({ target: smsConsents.userId, set: { ...preferences, updatedAt: new Date() } });
}

/**
 * Sends the birthday text to the member themselves, only if they opted in to birthday
 * messages. Called by the birthday job right after the wall post is created, which
 * already happens at most once per person per year, so this inherits that guarantee.
 */
export async function sendBirthdayGreeting(database: Database, deps: SmsDeps, userId: string) {
  const [row] = await database
    .select({ phone: users.phone, name: users.displayName, birthday: smsConsents.birthday })
    .from(users)
    .leftJoin(smsConsents, eq(smsConsents.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || !row.birthday || !row.phone) return { status: 'skipped' as const };

  return sendSms(deps, {
    to: row.phone,
    body: birthdayGreetingMessage(row.name),
    purpose: 'birthday',
    recipientUserId: userId,
  });
}

export interface DailyVersePayload {
  verse: { chapter: number; verseNumber: number; text: string };
  book: { name: string };
}

export interface DailyVerseSummary {
  considered: number;
  alreadySentToday: number;
  sent: number;
  dryRun: number;
  blocked: number;
  failed: number;
  stoppedForCap: boolean;
}

/**
 * Texts today's verse to members who opted in to it. Safe to call as often as a
 * scheduler likes: anyone already messaged today (live or dry-run) is skipped. If the
 * monthly cap is hit it stops straight away rather than logging a block per person.
 */
export async function sendDailyVerses(
  database: Database,
  deps: SmsDeps,
  options: { startOfTodayUtc: Date; getVerse: (translation: string) => Promise<DailyVersePayload> },
): Promise<DailyVerseSummary> {
  const summary: DailyVerseSummary = {
    considered: 0,
    alreadySentToday: 0,
    sent: 0,
    dryRun: 0,
    blocked: 0,
    failed: 0,
    stoppedForCap: false,
  };

  const members = await database
    .select({ id: users.id, phone: users.phone, translation: users.translation })
    .from(users)
    .innerJoin(smsConsents, eq(smsConsents.userId, users.id))
    .where(eq(smsConsents.dailyVerse, true));

  const targets = members.filter((member) => member.phone);
  summary.considered = targets.length;
  if (targets.length === 0) return summary;

  const already = await database
    .select({ userId: messageLog.recipientUserId })
    .from(messageLog)
    .where(
      and(
        eq(messageLog.purpose, 'daily_verse'),
        gte(messageLog.createdAt, options.startOfTodayUtc),
        inArray(messageLog.status, ['sent', 'delivered', 'dry_run']),
      ),
    );
  const alreadySent = new Set(already.map((row) => row.userId));

  const messageByTranslation = new Map<string, string>();
  const messageFor = async (translation: string) => {
    const cached = messageByTranslation.get(translation);
    if (cached) return cached;
    const payload = await options.getVerse(translation);
    const reference = `${payload.book.name} ${payload.verse.chapter}:${payload.verse.verseNumber}`;
    const message = dailyVerseMessage(reference, cleanVerseText(payload.verse.text));
    messageByTranslation.set(translation, message);
    return message;
  };

  for (const member of targets) {
    if (alreadySent.has(member.id)) {
      summary.alreadySentToday += 1;
      continue;
    }

    const result = await sendSms(deps, {
      to: member.phone!,
      body: await messageFor(member.translation || 'KJV'),
      purpose: 'daily_verse',
      recipientUserId: member.id,
    });

    if (result.status === 'sent' || result.status === 'delivered') summary.sent += 1;
    else if (result.status === 'dry_run') summary.dryRun += 1;
    else if (result.status === 'failed') summary.failed += 1;
    else {
      summary.blocked += 1;
      if (result.reason === 'monthly_cap') {
        summary.stoppedForCap = true;
        break;
      }
    }
  }

  return summary;
}
