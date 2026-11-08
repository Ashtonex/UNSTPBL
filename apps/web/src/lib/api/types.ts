// Shapes of the API's responses that the app uses. Types that also exist in @unstpbl/shared are
// imported from there, so the server and the app describe the same data once.
import type {
  BirthdayWallPost,
  UpcomingBirthday,
} from '@unstpbl/shared';

export interface AdminStats {
  memberCount: number;
  readRate: number;
}

export interface AdminAuditLog {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actorEmail: string;
  actorDisplayName?: string;
}

export interface UserProgress {
  totalReads: number;
  currentStreak: number;
  favoriteCount: number;
  openPrayerCount: number;
  recentReadDates: string[];
}

export interface FavoriteVerse {
  id: string;
  createdAt: string;
  verseId: number;
  text: string;
  chapter: number;
  verseNumber: number;
  translation: string;
  bookName: string;
  bookAbbreviation: string;
}

export interface BirthdayFeed {
  wall: BirthdayWallPost[];
  upcoming: UpcomingBirthday[];
}

export interface Visitor {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  invitedBy: string | null;
  notes: string | null;
  firstVisitDate: string;
  lastVisitDate: string;
  visitCount: number;
  smsConsent: boolean;
  welcomeSentAt: string | null;
  followupStatus: 'new' | 'contacted' | 'returning' | 'member';
  createdAt: string;
}

export interface NewVisitor {
  fullName: string;
  phone: string;
  email?: string;
  invitedBy?: string;
  notes?: string;
  smsConsent: boolean;
}

export interface RegisterVisitorResult {
  visitor: Visitor;
  created: boolean;
  visitRecorded: boolean;
  welcome: { status: string; reason?: string; detail?: string };
}

export type MessageAudience =
  | { type: 'all_members' }
  | { type: 'leaders' }
  | { type: 'visitors' }
  | { type: 'congregation'; congregation: string }
  | { type: 'circle'; circleId: string };

export interface MessagingStatus {
  provider: { name: string; live: boolean } | null;
  configError: string | null;
  dryRun: boolean;
  monthlySegmentCap: number;
  liveSegmentsUsed: number;
  costPerSegmentUsd: number | null;
  maxAudienceSize: number;
  whatsapp?: {
    provider: { name: string; live: boolean } | null;
    configError: string | null;
    dryRun: boolean;
    monthlyMessageCap: number;
    liveMessagesUsed: number;
    costPerMessageUsd: number | null;
  };
}

export interface SavedAnnouncement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface MessageTemplate {
  key: 'visitor_welcome' | 'birthday' | 'daily_verse';
  label: string;
  when: string;
  placeholders: Array<{ token: string; meaning: string }>;
  required: string[];
  defaultBody: string;
  body: string;
  isCustom: boolean;
  updatedAt: string | null;
  preview: { text: string; segments: number; encoding: 'gsm7' | 'ucs2'; characters: number };
}

export type TemplatePreview =
  | { valid: false; error: string }
  | { valid: true; body: string; preview: MessageTemplate['preview']; costPerMessageUsd: number | null };

export interface MessagePreview {
  finalMessage: string;
  encoding: 'gsm7' | 'ucs2';
  characters: number;
  segmentsPerMessage: number;
  tooLong: boolean;
  recipients: number;
  smsRecipients?: number;
  whatsappRecipients?: number;
  tooManyRecipients: boolean;
  sample: Array<{ name: string | null; phone: string }>;
  skippedInvalidPhone: number;
  skippedOptedOut: number;
  totalSegments: number;
  estimatedCostUsd: number | null;
  dryRun: boolean;
  willExceedCap: boolean;
}

export interface MessageLogEntry {
  id: string;
  channel?: 'sms' | 'whatsapp';
  purpose: string;
  phone: string;
  body: string;
  segments: number;
  status: 'sent' | 'delivered' | 'failed' | 'blocked' | 'dry_run';
  provider: string;
  error: string | null;
  createdAt: string;
}

export interface SmsPreferences {
  announcements: boolean;
  dailyVerse: boolean;
  birthday: boolean;
  /** How the member wants these texts delivered. */
  channel: 'sms' | 'whatsapp';
  phone: string | null;
  phoneUsable: boolean;
  optedOut: boolean;
}
