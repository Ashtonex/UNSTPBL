import { describe, expect, it } from 'vitest';
import {
  validateDaysQuery,
  validatePrayerBody,
  validateProfileUpdateBody,
  validatePushMessageBody,
  validateReflectionBody,
  validateScheduleBody,
  validateScheduledPushBody,
  validateSearchQuery,
} from './validation.js';

describe('validation helpers', () => {
  it('accepts a valid schedule payload', () => {
    expect(
      validateScheduleBody({
        date: '2026-07-16',
        bookId: 19,
        chapter: 119,
        verseNumber: 105,
      }),
    ).toEqual({
      ok: true,
      data: {
        date: '2026-07-16',
        bookId: 19,
        chapter: 119,
        verseNumber: 105,
      },
    });
  });

  it('rejects malformed dates and out-of-range references', () => {
    expect(validateScheduleBody({ date: '2026-99-99', bookId: 19, chapter: 1, verseNumber: 1 }).ok).toBe(false);
    expect(validateScheduleBody({ date: '2026-07-16', bookId: 67, chapter: 1, verseNumber: 1 }).ok).toBe(false);
    expect(validateScheduleBody({ date: '2026-07-16', bookId: 1, chapter: 151, verseNumber: 1 }).ok).toBe(false);
  });

  it('trims profile fields and limits translations', () => {
    expect(
      validateProfileUpdateBody({
        displayName: '  Grace  ',
        congregation: '  Mutare  ',
        translation: 'ESV',
      }),
    ).toEqual({
      ok: true,
      data: {
        displayName: 'Grace',
        congregation: 'Mutare',
        translation: 'ESV',
      },
    });

    expect(validateProfileUpdateBody({ translation: 'NIV' }).ok).toBe(false);
  });

  it('accepts an uploaded photo as a small image data URL, and a plain http(s) link', () => {
    const thumbnail = `data:image/jpeg;base64,${'A'.repeat(12_000)}`;
    expect(validateProfileUpdateBody({ avatarUrl: thumbnail })).toEqual({
      ok: true,
      data: { avatarUrl: thumbnail },
    });
    expect(validateProfileUpdateBody({ avatarUrl: ' https://example.org/me.png ' })).toEqual({
      ok: true,
      data: { avatarUrl: 'https://example.org/me.png' },
    });
    expect(validateProfileUpdateBody({ avatarUrl: '' })).toEqual({ ok: true, data: { avatarUrl: '' } });
  });

  it('rejects oversized, non-image and non-http avatars', () => {
    const tooBig = `data:image/jpeg;base64,${'A'.repeat(60_001)}`;
    expect(validateProfileUpdateBody({ avatarUrl: tooBig }).ok).toBe(false);
    expect(validateProfileUpdateBody({ avatarUrl: 'data:text/html;base64,PGgxPmhpPC9oMT4=' }).ok).toBe(false);
    expect(validateProfileUpdateBody({ avatarUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }).ok).toBe(false);
    expect(validateProfileUpdateBody({ avatarUrl: 'javascript:alert(1)' }).ok).toBe(false);
    expect(validateProfileUpdateBody({ avatarUrl: `https://example.org/${'a'.repeat(600)}` }).ok).toBe(false);
  });

  it('bounds search and history query inputs', () => {
    expect(validateSearchQuery(' faith ').ok).toBe(true);
    expect(validateSearchQuery('a').ok).toBe(false);
    expect(validateDaysQuery('30')).toEqual({ ok: true, data: 30 });
    expect(validateDaysQuery('500').ok).toBe(false);
  });

  it('requires concise push messages', () => {
    expect(validatePushMessageBody({ title: 'Daily Verse', body: 'A new verse is ready.' }).ok).toBe(true);
    expect(validatePushMessageBody({ title: '', body: 'Missing title' }).ok).toBe(false);
    expect(validatePushMessageBody({ title: 'x'.repeat(81), body: 'Too long' }).ok).toBe(false);
  });

  it('validates reflections and prayer requests', () => {
    expect(validateReflectionBody({ verseId: 1, content: 'A note' }).ok).toBe(true);
    expect(validateReflectionBody({ verseId: 1, content: '' }).ok).toBe(false);
    expect(validatePrayerBody({ title: 'Healing', content: 'Pray with me.' }).ok).toBe(true);
    expect(validatePrayerBody({ title: '', content: 'Missing title' }).ok).toBe(false);
  });

  it('validates scheduled push payloads', () => {
    expect(
      validateScheduledPushBody({
        title: 'Daily Verse',
        body: 'A new verse is ready.',
        scheduledFor: '2026-07-16T08:00:00.000Z',
      }).ok,
    ).toBe(true);
    expect(validateScheduledPushBody({ title: 'Daily Verse', body: 'Soon', scheduledFor: 'not-a-date' }).ok).toBe(false);
  });
});
