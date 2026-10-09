import { gsmCapacity, toSmsFriendly } from './encoding.js';

export const OPT_OUT_LINE = 'Reply STOP to opt out.';

// Longest a single message may be (in GSM-7 segments) before it is trimmed.
const VERSE_MAX_SEGMENTS = 2;
// Longest wording a leader may save, and the most segments a saved template may cost.
export const MAX_TEMPLATE_LENGTH = 320;
const MAX_TEMPLATE_SEGMENTS = 4;
// A daily verse template must leave at least this much room for the verse itself.
const MIN_VERSE_ROOM = 60;

export function churchName(): string {
  return process.env.CHURCH_NAME?.trim() || 'Victory Tabernacle City Mutare';
}

/** "  grace  moyo " -> "Grace". Falls back to a friendly word when there is no usable name. */
export function firstName(fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  if (!first) return 'friend';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// ── Editable templates ───────────────────────────────────────────────────────

export const TEMPLATE_KEYS = ['visitor_welcome', 'birthday', 'daily_verse'] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export function isTemplateKey(value: unknown): value is TemplateKey {
  return typeof value === 'string' && (TEMPLATE_KEYS as readonly string[]).includes(value);
}

export interface TemplateDefinition {
  label: string;
  when: string;
  /** Wording used until a leader changes it. The opt-out line is added by the system, never part of this. */
  defaultBody: string;
  placeholders: Array<{ token: string; meaning: string }>;
  /** Placeholders the wording must contain. */
  required: string[];
}

export const TEMPLATE_DEFINITIONS: Record<TemplateKey, TemplateDefinition> = {
  visitor_welcome: {
    label: 'Visitor thank-you',
    when: 'Sent once to a first-time visitor who agreed to be texted.',
    defaultBody: 'Hi {first_name}, thank you for joining us at {church}! We look forward to having you back.',
    placeholders: [
      { token: '{first_name}', meaning: "the visitor's first name" },
      { token: '{church}', meaning: 'the church name' },
    ],
    required: [],
  },
  birthday: {
    label: 'Birthday blessing',
    when: 'Sent on their birthday to members who switched birthday texts on.',
    defaultBody: 'Happy birthday, {first_name}! {church} celebrates you today. May God bless your new year.',
    placeholders: [
      { token: '{first_name}', meaning: "the member's first name" },
      { token: '{church}', meaning: 'the church name' },
    ],
    required: [],
  },
  daily_verse: {
    label: 'Daily verse',
    when: "Sent each morning to members who switched on today's verse.",
    defaultBody: '{reference}: {verse} - {church}.',
    placeholders: [
      { token: '{reference}', meaning: 'the book, chapter and verse' },
      { token: '{verse}', meaning: "today's verse (shortened automatically to fit)" },
      { token: '{church}', meaning: 'the church name' },
    ],
    required: ['{verse}'],
  },
};

export function defaultTemplateBody(key: TemplateKey): string {
  return TEMPLATE_DEFINITIONS[key].defaultBody;
}

type Vars = Record<string, string>;

/** Replaces known {tokens}; an unknown token is left out rather than sent as "{oops}". */
function fillTokens(body: string, vars: Vars): string {
  return body.replace(/\{(\w+)\}/g, (_match, name: string) => vars[name] ?? '');
}

/** The finished text: wording with tokens filled in, then the system's opt-out line. */
function compose(body: string, vars: Vars): string {
  return toSmsFriendly(`${fillTokens(body, vars)} ${OPT_OUT_LINE}`);
}

export function visitorWelcomeMessage(fullName: string, body: string = defaultTemplateBody('visitor_welcome')): string {
  return compose(body, { first_name: firstName(fullName), church: churchName() });
}

export function birthdayGreetingMessage(fullName: string | null | undefined, body: string = defaultTemplateBody('birthday')): string {
  return compose(body, { first_name: firstName(fullName), church: churchName() });
}

export function announcementMessage(body: string): string {
  return toSmsFriendly(`${body.trim()} - ${churchName()}. ${OPT_OUT_LINE}`);
}

/** Today's verse as an SMS, trimmed so it never grows past two segments. */
export function dailyVerseMessage(
  reference: string,
  verseText: string,
  body: string = defaultTemplateBody('daily_verse'),
): string {
  const vars = { reference, church: churchName() };
  // Measure the fixed part with a one-character stand-in for the verse.
  const fixed = compose(body, { ...vars, verse: 'x' }).length - 1;
  const budget = gsmCapacity(VERSE_MAX_SEGMENTS) - fixed;

  let text = toSmsFriendly(verseText);
  if (text.length > budget) text = `${text.slice(0, Math.max(0, budget - 3)).trimEnd()}...`;

  return compose(body, { ...vars, verse: text });
}

// ── Validation and preview ───────────────────────────────────────────────────

const SAMPLE_VERSE = 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';

/** A made-up recipient so a leader sees exactly how the finished text will read. */
export function sampleMessage(key: TemplateKey, body: string): string {
  if (key === 'visitor_welcome') return visitorWelcomeMessage('Grace Moyo', body);
  if (key === 'birthday') return birthdayGreetingMessage('Grace Moyo', body);
  return dailyVerseMessage('John 3:16', SAMPLE_VERSE, body);
}

export type TemplateCheck = { ok: true; body: string } | { ok: false; error: string };

/**
 * Cleans and checks wording before it is saved. The opt-out line is added by the system,
 * so one typed by hand is removed rather than doubled up.
 */
export function checkTemplateBody(key: TemplateKey, raw: unknown): TemplateCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'The wording must be text.' };

  const body = raw
    .replace(/\s*reply\s+stop\s+to\s+opt[\s-]*out\.?\s*$/i, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (body === '') return { ok: false, error: 'The wording cannot be empty.' };
  if (body.length > MAX_TEMPLATE_LENGTH) {
    return { ok: false, error: `Keep the wording under ${MAX_TEMPLATE_LENGTH} characters.` };
  }

  const definition = TEMPLATE_DEFINITIONS[key];
  const allowed = new Set(definition.placeholders.map((p) => p.token));
  for (const token of body.match(/\{[^{}]*\}/g) ?? []) {
    if (!allowed.has(token)) {
      return { ok: false, error: `${token} is not available here. You can use: ${[...allowed].join(', ')}.` };
    }
  }
  for (const token of definition.required) {
    if (!body.includes(token)) return { ok: false, error: `The wording must include ${token}.` };
  }

  if (key === 'daily_verse') {
    const room = gsmCapacity(VERSE_MAX_SEGMENTS) - (compose(body, { reference: 'Deuteronomy 33:29', church: churchName(), verse: 'x' }).length - 1);
    if (room < MIN_VERSE_ROOM) {
      return { ok: false, error: 'That wording leaves too little room for the verse. Shorten it.' };
    }
  } else {
    // Measure the longest realistic outcome: a long first name.
    const longest = key === 'visitor_welcome' ? visitorWelcomeMessage('Christopherson', body) : birthdayGreetingMessage('Christopherson', body);
    if (longest.length > gsmCapacity(MAX_TEMPLATE_SEGMENTS)) return { ok: false, error: 'That wording is too long once names are filled in.' };
  }

  return { ok: true, body };
}
