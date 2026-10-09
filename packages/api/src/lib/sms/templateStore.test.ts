import { describe, expect, it, vi } from 'vitest';
import type { Database } from '@unstpbl/db';
import { buildTemplateView, getTemplateBody } from './templateStore.js';
import { defaultTemplateBody } from './templates.js';

// A database whose select().from().where().limit() resolves to `result`, or rejects.
const fakeDb = (result: unknown): Database =>
  ({
    select: () => ({ from: () => ({ where: () => ({ limit: () => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result)) }) }) }),
  }) as unknown as Database;

describe('getTemplateBody', () => {
  it('uses the saved wording when there is a row', async () => {
    expect(await getTemplateBody(fakeDb([{ body: 'Custom {first_name}' }]), 'birthday')).toBe('Custom {first_name}');
  });

  it('uses the default when nothing is saved', async () => {
    expect(await getTemplateBody(fakeDb([]), 'birthday')).toBe(defaultTemplateBody('birthday'));
  });

  it('uses the default when the saved wording is blank', async () => {
    expect(await getTemplateBody(fakeDb([{ body: '   ' }]), 'visitor_welcome')).toBe(defaultTemplateBody('visitor_welcome'));
  });

  it('never fails a send when the database cannot be read (for example, before the migration)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await getTemplateBody(fakeDb(new Error('relation "message_templates" does not exist')), 'daily_verse')).toBe(
      defaultTemplateBody('daily_verse'),
    );
  });
});

describe('buildTemplateView', () => {
  it('marks default wording as not custom and shows a sample with cost-relevant length', () => {
    const view = buildTemplateView('visitor_welcome', undefined);
    expect(view.isCustom).toBe(false);
    expect(view.preview.segments).toBeGreaterThan(0);
    expect(view.preview.text).toContain('Reply STOP to opt out.');
  });

  it('marks saved wording as custom', () => {
    const view = buildTemplateView('birthday', { body: 'Happy day {first_name}!', updatedAt: new Date('2026-10-12T08:00:00Z') });
    expect(view.isCustom).toBe(true);
    expect(view.updatedAt).toBe('2026-10-12T08:00:00.000Z');
    expect(view.preview.text).toContain('Happy day Grace!');
  });
});
