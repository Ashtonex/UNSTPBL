import { validateUuid } from '../validation.js';
import type { Audience } from './audience.js';
import { normalizePhone } from './phone.js';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, field: string, max: number): Result<string | null> {
  if (value === undefined || value === null) return { ok: true, data: null };
  if (typeof value !== 'string') return fail(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) return fail(`${field} must be ${max} characters or less.`);
  return { ok: true, data: trimmed === '' ? null : trimmed };
}

export const FOLLOWUP_STATUSES = ['new', 'contacted', 'returning', 'member'] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const MAX_ANNOUNCEMENT_LENGTH = 320;

export interface VisitorBody {
  fullName: string;
  phone: string;
  email: string | null;
  invitedBy: string | null;
  notes: string | null;
  smsConsent: boolean;
}

export function validateVisitorBody(body: unknown): Result<VisitorBody> {
  if (!isRecord(body)) return fail('Request body must be an object.');

  if (typeof body.fullName !== 'string' || body.fullName.trim() === '') return fail('The visitor\'s name is required.');
  const fullName = body.fullName.trim();
  if (fullName.length > 120) return fail('Name must be 120 characters or less.');

  const phone = normalizePhone(body.phone);
  if (!phone.ok) return fail(phone.error);

  const email = optionalText(body.email, 'Email', 255);
  if (!email.ok) return email;
  if (email.data && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.data)) return fail('That email address does not look right.');

  const invitedBy = optionalText(body.invitedBy, 'Invited by', 120);
  if (!invitedBy.ok) return invitedBy;
  const notes = optionalText(body.notes, 'Notes', 1000);
  if (!notes.ok) return notes;

  if (body.smsConsent !== undefined && typeof body.smsConsent !== 'boolean') return fail('smsConsent must be true or false.');

  return {
    ok: true,
    data: {
      fullName,
      phone: phone.e164,
      email: email.data,
      invitedBy: invitedBy.data,
      notes: notes.data,
      smsConsent: body.smsConsent === true,
    },
  };
}

export function validateVisitorPatch(body: unknown): Result<{ followupStatus?: FollowupStatus; notes?: string | null }> {
  if (!isRecord(body)) return fail('Request body must be an object.');
  const data: { followupStatus?: FollowupStatus; notes?: string | null } = {};

  if (body.followupStatus !== undefined) {
    if (typeof body.followupStatus !== 'string' || !(FOLLOWUP_STATUSES as readonly string[]).includes(body.followupStatus)) {
      return fail(`followupStatus must be one of: ${FOLLOWUP_STATUSES.join(', ')}.`);
    }
    data.followupStatus = body.followupStatus as FollowupStatus;
  }
  if (body.notes !== undefined) {
    const notes = optionalText(body.notes, 'Notes', 1000);
    if (!notes.ok) return notes;
    data.notes = notes.data;
  }
  if (Object.keys(data).length === 0) return fail('Nothing to update.');
  return { ok: true, data };
}

export function validateAudience(value: unknown): Result<Audience> {
  if (!isRecord(value) || typeof value.type !== 'string') return fail('Choose who the message is for.');

  switch (value.type) {
    case 'all_members':
    case 'leaders':
    case 'visitors':
      return { ok: true, data: { type: value.type } };
    case 'congregation': {
      if (typeof value.congregation !== 'string' || value.congregation.trim() === '') return fail('Choose a congregation.');
      if (value.congregation.length > 120) return fail('Congregation name is too long.');
      return { ok: true, data: { type: 'congregation', congregation: value.congregation.trim() } };
    }
    case 'circle': {
      const id = validateUuid(value.circleId, 'circleId');
      if (!id.ok) return fail(id.error);
      return { ok: true, data: { type: 'circle', circleId: id.data } };
    }
    default:
      return fail('Unknown audience.');
  }
}

export function validateMessageText(value: unknown): Result<string> {
  if (typeof value !== 'string' || value.trim() === '') return fail('Write a message first.');
  const trimmed = value.trim();
  if (trimmed.length > MAX_ANNOUNCEMENT_LENGTH) {
    return fail(`Keep the message to ${MAX_ANNOUNCEMENT_LENGTH} characters or less (the opt-out line is added automatically).`);
  }
  return { ok: true, data: trimmed };
}

export function validateSavedAnnouncement(body: unknown): Result<{ title: string; body: string }> {
  if (!isRecord(body)) return fail('Request body must be an object.');
  if (typeof body.title !== 'string' || body.title.trim() === '') return fail('Give the message a short name.');
  const title = body.title.trim();
  if (title.length > 80) return fail('The name must be 80 characters or less.');
  const text = validateMessageText(body.body);
  if (!text.ok) return text;
  return { ok: true, data: { title, body: text.data } };
}

export function validatePreviewBody(body: unknown): Result<{ message: string; audience: Audience }> {
  if (!isRecord(body)) return fail('Request body must be an object.');
  const message = validateMessageText(body.message);
  if (!message.ok) return message;
  const audience = validateAudience(body.audience);
  if (!audience.ok) return audience;
  return { ok: true, data: { message: message.data, audience: audience.data } };
}

export function validateSendBody(body: unknown): Result<{ message: string; audience: Audience; confirmRecipients: number }> {
  const preview = validatePreviewBody(body);
  if (!preview.ok) return preview;
  const confirm = (body as Record<string, unknown>).confirmRecipients;
  if (typeof confirm !== 'number' || !Number.isInteger(confirm) || confirm < 1) {
    return fail('Confirm the number of recipients shown in the preview.');
  }
  return { ok: true, data: { ...preview.data, confirmRecipients: confirm } };
}

export function validateSmsPreferencesBody(
  body: unknown,
): Result<{ announcements: boolean; dailyVerse: boolean; birthday: boolean; channel: 'sms' | 'whatsapp' }> {
  if (!isRecord(body)) return fail('Request body must be an object.');
  const data = { announcements: false, dailyVerse: false, birthday: false, channel: 'sms' as 'sms' | 'whatsapp' };
  for (const key of ['announcements', 'dailyVerse', 'birthday'] as const) {
    if (typeof body[key] !== 'boolean') return fail(`${key} must be true or false.`);
    data[key] = body[key] as boolean;
  }
  if (body.channel !== undefined) {
    if (body.channel !== 'sms' && body.channel !== 'whatsapp') return fail('channel must be "sms" or "whatsapp".');
    data.channel = body.channel;
  }
  return { ok: true, data };
}
