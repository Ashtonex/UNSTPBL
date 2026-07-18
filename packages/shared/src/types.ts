export type UserRole = 'member' | 'bishop' | 'admin';
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

export interface PrayerRequest {
  id: string;
  userId: string;
  title: string;
  content: string;
  status: 'open' | 'answered';
  createdAt: string;
  answeredAt?: string | null;
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
    congregation?: string | null;
  } | null;
  _count?: {
    joins: number;
  };
  hasJoined?: boolean;
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
