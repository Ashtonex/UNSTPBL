import { gsmCapacity, toSmsFriendly } from './encoding.js';

export const OPT_OUT_LINE = 'Reply STOP to opt out.';

// Longest a single message may be (in GSM-7 segments) before it is trimmed.
const VERSE_MAX_SEGMENTS = 2;

export function churchName(): string {
  return process.env.CHURCH_NAME?.trim() || 'Victory Tabernacle City Mutare';
}

/** "  grace  moyo " -> "Grace". Falls back to a friendly word when there is no usable name. */
export function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  if (!first) return 'friend';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function visitorWelcomeMessage(fullName: string): string {
  return toSmsFriendly(
    `Hi ${firstName(fullName)}, thank you for joining us at ${churchName()}! We look forward to having you back. ${OPT_OUT_LINE}`,
  );
}

export function birthdayGreetingMessage(fullName: string | null | undefined): string {
  return toSmsFriendly(
    `Happy birthday, ${firstName(fullName)}! ${churchName()} celebrates you today. May God bless your new year. ${OPT_OUT_LINE}`,
  );
}

export function announcementMessage(body: string): string {
  return toSmsFriendly(`${body.trim()} - ${churchName()}. ${OPT_OUT_LINE}`);
}

/** Today's verse as an SMS, trimmed so it never grows past two segments. */
export function dailyVerseMessage(reference: string, verseText: string): string {
  const head = `${reference}: `;
  const footer = ` - ${churchName()}. ${OPT_OUT_LINE}`;
  const budget = gsmCapacity(VERSE_MAX_SEGMENTS) - head.length - footer.length;

  let text = toSmsFriendly(verseText);
  if (text.length > budget) text = `${text.slice(0, Math.max(0, budget - 3)).trimEnd()}...`;

  return toSmsFriendly(`${head}${text}${footer}`);
}
