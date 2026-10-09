import { afterEach, describe, expect, it } from 'vitest';
import { maskPhone, normalizePhone } from './phone.js';
import { analyzeSms, toSmsFriendly } from './encoding.js';
import {
  OPT_OUT_LINE,
  announcementMessage,
  birthdayGreetingMessage,
  dailyVerseMessage,
  firstName,
  visitorWelcomeMessage,
} from './templates.js';

describe('normalizePhone', () => {
  it.each([
    ['0771234567', '+263771234567'],
    ['077 123 4567', '+263771234567'],
    ['+263 77 123 4567', '+263771234567'],
    ['263771234567', '+263771234567'],
    ['00263771234567', '+263771234567'],
    ['771234567', '+263771234567'],
    ['(0712) 345-678', '+263712345678'],
    ['0732345678', '+263732345678'],
    ['0782345678', '+263782345678'],
  ])('accepts %s as %s', (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, e164: expected });
  });

  it('accepts other countries in international form', () => {
    expect(normalizePhone('+27 82 123 4567')).toEqual({ ok: true, e164: '+27821234567' });
    expect(normalizePhone('0044 7911 123456')).toEqual({ ok: true, e164: '+447911123456' });
  });

  it.each([
    ['', 'required'],
    ['   ', 'required'],
    ['abc', 'digits'],
    ['0771234', 'mobile'], // too short for a Zimbabwean mobile
    ['0202123456', 'mobile'], // Mutare landline: cannot receive SMS
    ['0761234567', 'mobile'], // 76 is not a Zimbabwean mobile prefix
    ['+263 7712 34567890', 'mobile'], // too long for a Zimbabwean mobile
    ['+1234567890123456', 'valid phone'], // over the 15-digit E.164 maximum
    ['1234567', 'valid phone'], // too short to be any number
    ['077-123-4567; drop table', 'digits'],
  ])('rejects %j', (input, messagePart) => {
    const result = normalizePhone(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(messagePart);
  });

  it('rejects non-strings', () => {
    expect(normalizePhone(undefined).ok).toBe(false);
    expect(normalizePhone(263771234567).ok).toBe(false);
  });

  it('masks all but the prefix and last four digits', () => {
    expect(maskPhone('+263771234567')).toBe('+26377 ••• 4567');
  });
});

describe('SMS encoding and segments', () => {
  it('counts 160 plain characters as one segment and 161 as two', () => {
    expect(analyzeSms('a'.repeat(160))).toEqual({ encoding: 'gsm7', length: 160, segments: 1 });
    expect(analyzeSms('a'.repeat(161)).segments).toBe(2);
    expect(analyzeSms('a'.repeat(306)).segments).toBe(2);
    expect(analyzeSms('a'.repeat(307)).segments).toBe(3);
  });

  it('counts GSM extension characters (like { and ~) as two', () => {
    expect(analyzeSms('{}').length).toBe(4);
    expect(analyzeSms('a'.repeat(159) + '{').segments).toBe(2);
  });

  it('switches to the much smaller UCS-2 limit for a curly quote or emoji', () => {
    const curly = analyzeSms('He said “hello”');
    expect(curly.encoding).toBe('ucs2');
    expect(analyzeSms('a'.repeat(71) + '“').segments).toBe(2);
    expect(analyzeSms('Bless you 🙏').encoding).toBe('ucs2');
  });

  it('normalises typographic characters so verses stay cheap', () => {
    const verse = 'Thy word is a lamp — and “a light” unto my path… it’s true';
    const friendly = toSmsFriendly(verse);
    expect(friendly).toBe('Thy word is a lamp - and "a light" unto my path... it\'s true');
    expect(analyzeSms(friendly).encoding).toBe('gsm7');
  });

  it('treats empty text as zero segments', () => {
    expect(analyzeSms('').segments).toBe(0);
  });
});

describe('message templates', () => {
  afterEach(() => {
    delete process.env.CHURCH_NAME;
  });

  it('greets visitors by first name and always offers an opt-out', () => {
    process.env.CHURCH_NAME = 'Test Church';
    const message = visitorWelcomeMessage('  grace MOYO ');
    expect(message).toContain('Hi Grace,');
    expect(message).toContain('Test Church');
    expect(message).toContain('look forward to having you back');
    expect(message.endsWith(OPT_OUT_LINE)).toBe(true);
    expect(analyzeSms(message).segments).toBeLessThanOrEqual(2);
  });

  it('falls back to a friendly word when there is no name', () => {
    expect(firstName('')).toBe('friend');
    expect(firstName(null)).toBe('friend');
    expect(visitorWelcomeMessage('   ')).toContain('Hi friend,');
  });

  it('builds birthday and announcement messages with the opt-out line', () => {
    expect(birthdayGreetingMessage('tendai')).toContain('Happy birthday, Tendai!');
    expect(birthdayGreetingMessage('tendai').endsWith(OPT_OUT_LINE)).toBe(true);
    const announcement = announcementMessage('  Service moves to 9am this Sunday.  ');
    expect(announcement.startsWith('Service moves to 9am this Sunday. - ')).toBe(true);
    expect(announcement.endsWith(OPT_OUT_LINE)).toBe(true);
  });

  it('keeps a long verse within two segments by trimming it', () => {
    const longVerse = 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life. '.repeat(3);
    const message = dailyVerseMessage('John 3:16', longVerse);
    expect(analyzeSms(message).segments).toBeLessThanOrEqual(2);
    expect(message.startsWith('John 3:16: For God so loved')).toBe(true);
    expect(message).toContain('...');
    expect(message.endsWith(OPT_OUT_LINE)).toBe(true);
  });

  it('leaves a short verse untouched and in plain encoding', () => {
    const message = dailyVerseMessage('Psalm 119:105', 'Thy word is a lamp unto my feet, and a light unto my path.');
    expect(message).toContain('Thy word is a lamp unto my feet, and a light unto my path.');
    expect(message).not.toContain('...');
    expect(analyzeSms(message).encoding).toBe('gsm7');
  });
});
