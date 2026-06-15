export type UserRole = 'member' | 'bishop';
export type Testament = 'old' | 'new';
export type VerseMode = 'manual' | 'sequential';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string;
  congregation?: string;
  pushSubscription?: PushSubscriptionData | null;
  createdAt: string;
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
