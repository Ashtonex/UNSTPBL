import type { UserRole } from './roles.js';

export type { UserRole };
export type Testament = 'old' | 'new';
export type VerseMode = 'manual' | 'sequential';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
  congregation?: string;
  translation?: string;
  bio?: string | null;
  phone?: string | null;
  location?: string | null;
  birthday?: string | null;
  birthdayVisibility?: 'members' | 'private';
  avatarUrl?: string | null;
  pushSubscription?: PushSubscriptionData | null;
  createdAt: string;
}

export interface BirthdayWallPost {
  id: string;
  userId: string;
  birthdayDate: string;
  birthdayYear: number;
  message: string;
  createdAt: string;
  user: {
    id: string;
    displayName?: string | null;
    congregation?: string | null;
    avatarUrl?: string | null;
  };
}

export interface UpcomingBirthday {
  userId: string;
  displayName?: string | null;
  congregation?: string | null;
  avatarUrl?: string | null;
  birthday: string;
  daysUntil: number;
}

export interface BibleBook {
  id: number;
  name: string;
  abbreviation: string;
  testament: Testament;
}

export interface BibleVerse {
  id: number;
  bookId: number;
  chapter: number;
  verseNumber: number;
  text: string;
  translation: string;
}

export interface VerseSchedule {
  id: string;
  date: string;
  verseId: number;
  mode: VerseMode;
  bookId?: number;
  chapter?: number;
  sequenceIndex?: number;
  dispatchedAt?: string;
  pastoralNote?: string | null;
}

export interface VerseReading {
  id: string;
  userId: string;
  verseScheduleId: string;
  readAt: string;
}

export interface DailyVerse {
  schedule: VerseSchedule;
  verse: BibleVerse;
  book: BibleBook;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface ApiError {
  error: string;
  statusCode?: number;
}

export type PrayerType = 'request' | 'praise';

/** A prayer row as stored. POST /prayers and PUT /prayers/:id/answered return this. */
export interface PrayerRequestRecord {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: 'open' | 'answered';
  type: PrayerType;
  isAnonymous: boolean;
  circleId: string | null;
  createdAt: string;
  answeredAt: string | null;
}

/** A prayer as listed by GET /prayers: the row plus its author, how many joined, and whether you did. */
export interface PrayerRequest extends Omit<PrayerRequestRecord, 'circleId'> {
  /** The author, or a generic name when the prayer was posted anonymously. */
  user: { displayName: string | null; congregation: string | null };
  _count: { joins: number };
  hasJoined: boolean;
}

export interface PrayerJoin {
  id: string;
  userId: string;
  prayerRequestId: string;
  createdAt: string;
}

export interface VerseReflection {
  id: string;
  userId: string;
  verseId: number;
  verseScheduleId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
    congregation?: string | null;
  } | null;
}

export interface Circle {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface Sermon {
  id: string;
  title: string;
  preacher: string;
  date: string;
  outline: string;
  createdAt: string;
}

export interface UserSermonNote {
  id: string;
  userId: string;
  sermonId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface TriviaQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string | null;
  weekDate: string;
  createdAt: string;
  hasAnswered?: boolean;
  selectedOptionIndex?: number;
  isCorrect?: boolean;
}

export interface UserTriviaResponse {
  id: string;
  userId: string;
  questionId: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
  createdAt: string;
}

/** A family circle as returned by GET /circles: the circle plus whether the caller has joined. */
export interface CircleWithMembership extends Circle {
  hasJoined: boolean;
}

/** One church-wide reading goal from GET /stats/milestones. */
export interface Milestone {
  target: number;
  label: string;
  desc: string;
  achieved: boolean;
}

export type ScheduledPushStatus = 'scheduled' | 'sent' | 'cancelled';

/** A push notification a leader scheduled (admin/push endpoints). */
export interface ScheduledPushNotification {
  id: string;
  createdByUserId: string;
  title: string;
  body: string;
  url: string | null;
  scheduledFor: string;
  status: ScheduledPushStatus;
  sentAt: string | null;
  createdAt: string;
}

/** A verse that matched a search or is related to another verse, with its book and a 0..1 score. */
export interface VerseMatch {
  verse: BibleVerse;
  book: BibleBook;
  score: number;
}
