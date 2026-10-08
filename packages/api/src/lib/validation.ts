type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SUPPORTED_TRANSLATIONS = new Set(['KJV', 'ESV']);
const SUPPORTED_ROLES = new Set(['member', 'bishop', 'admin']);
const BIRTHDAY_VISIBILITY = new Set(['members', 'private']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, field: string, maxLength: number, required = false): ValidationResult<string | undefined> {
  if (value === undefined || value === null) {
    return required ? { ok: false, error: `${field} is required` } : { ok: true, data: undefined };
  }

  if (typeof value !== 'string') {
    return { ok: false, error: `${field} must be a string` };
  }

  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    return { ok: false, error: `${field} is required` };
  }

  if (trimmed.length > maxLength) {
    return { ok: false, error: `${field} must be ${maxLength} characters or less` };
  }

  return { ok: true, data: trimmed };
}

// A profile photo is either a link or a small data URL made by the profile page's
// resize step. The page used to send a ~40 kB data URL while this field was capped
// at 512 characters, so saving an uploaded photo always failed. Data URLs are now
// allowed, but only real image types and only up to a size that suits a thumbnail.
const AVATAR_LINK_MAX = 512;
const AVATAR_DATA_URL_MAX = 60_000;
const AVATAR_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

function avatarValue(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined || value === null) return { ok: true, data: undefined };
  if (typeof value !== 'string') return { ok: false, error: 'avatarUrl must be a string' };

  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, data: '' };

  if (trimmed.startsWith('data:')) {
    if (!AVATAR_DATA_URL.test(trimmed)) {
      return { ok: false, error: 'avatarUrl must be a JPEG, PNG or WebP image' };
    }
    if (trimmed.length > AVATAR_DATA_URL_MAX) {
      return { ok: false, error: 'That photo is too large. Please choose a smaller one.' };
    }
    return { ok: true, data: trimmed };
  }

  if (trimmed.length > AVATAR_LINK_MAX) {
    return { ok: false, error: `avatarUrl must be ${AVATAR_LINK_MAX} characters or less` };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: 'avatarUrl must be an http(s) link or an uploaded image' };
  }
  return { ok: true, data: trimmed };
}

function positiveInteger(value: unknown, field: string, max: number): ValidationResult<number> {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    return { ok: false, error: `${field} must be an integer between 1 and ${max}` };
  }
  return { ok: true, data: parsed };
}

function isoDate(value: unknown): ValidationResult<string> {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: 'date must use YYYY-MM-DD format' };
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: 'date is invalid' };
  }

  return { ok: true, data: value };
}

export function validateRoleUpdateBody(body: unknown): ValidationResult<{ role: 'member' | 'bishop' | 'admin' }> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };
  if (typeof body.role !== 'string' || !SUPPORTED_ROLES.has(body.role)) {
    return { ok: false, error: 'role must be one of: member, bishop, admin' };
  }
  return { ok: true, data: { role: body.role as 'member' | 'bishop' | 'admin' } };
}

export function validateUuid(value: unknown, field: string): ValidationResult<string> {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    return { ok: false, error: `${field} must be a valid UUID` };
  }
  return { ok: true, data: value };
}

export function validateReadBody(body: unknown): ValidationResult<{ verseScheduleId: string }> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };
  const verseScheduleId = validateUuid(body.verseScheduleId, 'verseScheduleId');
  if (!verseScheduleId.ok) return verseScheduleId;
  return { ok: true, data: { verseScheduleId: verseScheduleId.data } };
}

export function validateVerseIdBody(body: unknown): ValidationResult<{ verseId: number }> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };
  const verseId = positiveInteger(body.verseId, 'verseId', 1_000_000);
  if (!verseId.ok) return verseId;
  return { ok: true, data: { verseId: verseId.data } };
}

export function validateScheduleBody(body: unknown): ValidationResult<{
  date: string;
  bookId: number;
  chapter: number;
  verseNumber: number;
  pastoralNote?: string;
}> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  const date = isoDate(body.date);
  if (!date.ok) return date;

  const bookId = positiveInteger(body.bookId, 'bookId', 66);
  if (!bookId.ok) return bookId;

  const chapter = positiveInteger(body.chapter, 'chapter', 150);
  if (!chapter.ok) return chapter;

  const verseNumber = positiveInteger(body.verseNumber, 'verseNumber', 176);
  if (!verseNumber.ok) return verseNumber;

  const pastoralNote = cleanString(body.pastoralNote, 'pastoralNote', 5000);
  if (!pastoralNote.ok) return pastoralNote;

  return {
    ok: true,
    data: {
      date: date.data,
      bookId: bookId.data,
      chapter: chapter.data,
      verseNumber: verseNumber.data,
      ...(pastoralNote.data ? { pastoralNote: pastoralNote.data } : {}),
    },
  };
}

export function validateProfileUpdateBody(body: unknown): ValidationResult<{
  displayName?: string;
  congregation?: string;
  translation?: string;
  bio?: string;
  phone?: string;
  location?: string;
  birthday?: string | null;
  birthdayVisibility?: string;
  avatarUrl?: string;
}> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };
  if (Object.keys(body).length === 0) return { ok: false, error: 'At least one profile field is required' };

  const displayName = cleanString(body.displayName, 'displayName', 120);
  if (!displayName.ok) return displayName;

  const congregation = cleanString(body.congregation, 'congregation', 120);
  if (!congregation.ok) return congregation;

  const bio = cleanString(body.bio, 'bio', 500);
  if (!bio.ok) return bio;

  const phone = cleanString(body.phone, 'phone', 40);
  if (!phone.ok) return phone;

  const location = cleanString(body.location, 'location', 120);
  if (!location.ok) return location;

  const avatarUrl = avatarValue(body.avatarUrl);
  if (!avatarUrl.ok) return avatarUrl;

  if (body.translation !== undefined && (typeof body.translation !== 'string' || !SUPPORTED_TRANSLATIONS.has(body.translation))) {
    return { ok: false, error: 'translation must be one of: KJV, ESV' };
  }

  let birthday: string | null | undefined;
  if (body.birthday === null || body.birthday === '') {
    birthday = null;
  } else if (body.birthday !== undefined) {
    const birthdayResult = isoDate(body.birthday);
    if (!birthdayResult.ok) return { ok: false, error: 'birthday must use YYYY-MM-DD format' };
    const birthdayDate = new Date(`${birthdayResult.data}T00:00:00.000Z`);
    if (birthdayDate > new Date()) {
      return { ok: false, error: 'birthday cannot be in the future' };
    }
    birthday = birthdayResult.data;
  }

  if (
    body.birthdayVisibility !== undefined &&
    (typeof body.birthdayVisibility !== 'string' || !BIRTHDAY_VISIBILITY.has(body.birthdayVisibility))
  ) {
    return { ok: false, error: 'birthdayVisibility must be one of: members, private' };
  }

  return {
    ok: true,
    data: {
      ...(displayName.data !== undefined ? { displayName: displayName.data } : {}),
      ...(congregation.data !== undefined ? { congregation: congregation.data } : {}),
      ...(body.translation !== undefined ? { translation: body.translation } : {}),
      ...(bio.data !== undefined ? { bio: bio.data } : {}),
      ...(phone.data !== undefined ? { phone: phone.data } : {}),
      ...(location.data !== undefined ? { location: location.data } : {}),
      ...(birthday !== undefined ? { birthday } : {}),
      ...(body.birthdayVisibility !== undefined ? { birthdayVisibility: body.birthdayVisibility } : {}),
      ...(avatarUrl.data !== undefined ? { avatarUrl: avatarUrl.data } : {}),
    },
  };
}

export function validatePushSubscriptionBody(body: unknown): ValidationResult<{
  endpoint: string;
  keys: { p256dh: string; auth: string };
}> {
  if (!isRecord(body) || !isRecord(body.keys)) {
    return { ok: false, error: 'Subscription payload is invalid' };
  }

  const endpoint = cleanString(body.endpoint, 'endpoint', 2048, true);
  if (!endpoint.ok) return endpoint;
  const endpointValue = endpoint.data as string;
  if (!endpointValue.startsWith('https://') && !endpointValue.startsWith('http://localhost')) {
    return { ok: false, error: 'endpoint must be HTTPS' };
  }

  const p256dh = cleanString(body.keys.p256dh, 'keys.p256dh', 512, true);
  if (!p256dh.ok) return p256dh;
  const p256dhValue = p256dh.data as string;

  const auth = cleanString(body.keys.auth, 'keys.auth', 256, true);
  if (!auth.ok) return auth;
  const authValue = auth.data as string;

  return { ok: true, data: { endpoint: endpointValue, keys: { p256dh: p256dhValue, auth: authValue } } };
}

export function validatePushMessageBody(body: unknown): ValidationResult<{
  title: string;
  body: string;
  url?: string;
}> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  const title = cleanString(body.title, 'title', 80, true);
  if (!title.ok) return title;
  const titleValue = title.data as string;

  const messageBody = cleanString(body.body, 'body', 240, true);
  if (!messageBody.ok) return messageBody;
  const bodyValue = messageBody.data as string;

  const url = cleanString(body.url, 'url', 512);
  if (!url.ok) return url;

  return {
    ok: true,
    data: {
      title: titleValue,
      body: bodyValue,
      ...(url.data ? { url: url.data } : {}),
    },
  };
}

export function validateReflectionBody(body: unknown): ValidationResult<{
  verseId: number;
  verseScheduleId?: string;
  content: string;
}> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  const verseId = positiveInteger(body.verseId, 'verseId', 1_000_000);
  if (!verseId.ok) return verseId;

  let verseScheduleId: string | undefined;
  if (body.verseScheduleId !== undefined && body.verseScheduleId !== null && body.verseScheduleId !== '') {
    const scheduleId = validateUuid(body.verseScheduleId, 'verseScheduleId');
    if (!scheduleId.ok) return scheduleId;
    verseScheduleId = scheduleId.data;
  }

  const content = cleanString(body.content, 'content', 2_000, true);
  if (!content.ok) return content;

  return {
    ok: true,
    data: {
      verseId: verseId.data,
      ...(verseScheduleId ? { verseScheduleId } : {}),
      content: content.data as string,
    },
  };
}

export function validatePrayerBody(body: unknown): ValidationResult<{
  title: string;
  content: string;
  type?: string;
  isAnonymous?: boolean;
}> {
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  const title = cleanString(body.title, 'title', 120, true);
  if (!title.ok) return title;

  const content = cleanString(body.content, 'content', 2_000, true);
  if (!content.ok) return content;

  const type = body.type === 'praise' ? 'praise' : 'request';
  const isAnonymous = !!body.isAnonymous;

  return {
    ok: true,
    data: {
      title: title.data as string,
      content: content.data as string,
      type,
      isAnonymous
    }
  };
}

export function validateScheduledPushBody(body: unknown): ValidationResult<{
  title: string;
  body: string;
  url?: string;
  scheduledFor: Date;
}> {
  const message = validatePushMessageBody(body);
  if (!message.ok) return message;
  if (!isRecord(body)) return { ok: false, error: 'Request body must be an object' };

  if (typeof body.scheduledFor !== 'string') {
    return { ok: false, error: 'scheduledFor must be an ISO date-time string' };
  }

  const scheduledFor = new Date(body.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    return { ok: false, error: 'scheduledFor must be a valid date-time' };
  }

  return { ok: true, data: { ...message.data, scheduledFor } };
}

export function validateDaysQuery(value: string | undefined): ValidationResult<number> {
  if (value === undefined) return { ok: true, data: 7 };
  return positiveInteger(value, 'days', 90);
}

export function validateSearchQuery(value: string | undefined): ValidationResult<string> {
  const query = cleanString(value, 'q', 120, true);
  if (!query.ok) return query;
  const queryValue = query.data as string;
  if (queryValue.length < 2) {
    return { ok: false, error: 'q must be at least 2 characters' };
  }
  return { ok: true, data: queryValue };
}
