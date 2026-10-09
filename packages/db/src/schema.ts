import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  serial,
  integer,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  boolean,
  numeric,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['member', 'bishop', 'admin']);
export const testamentEnum = pgEnum('testament', ['old', 'new']);
export const verseModeEnum = pgEnum('verse_mode', ['manual', 'sequential']);
export const prayerStatusEnum = pgEnum('prayer_status', ['open', 'answered']);
export const scheduledPushStatusEnum = pgEnum('scheduled_push_status', ['scheduled', 'sent', 'cancelled']);

// ── Tables ──────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // matches Supabase auth.users.id
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: userRoleEnum('role').notNull().default('member'),
  displayName: varchar('display_name', { length: 255 }),
  congregation: varchar('congregation', { length: 255 }),
  translation: varchar('translation', { length: 10 }).notNull().default('KJV'),
  bio: text('bio'),
  phone: varchar('phone', { length: 40 }),
  location: varchar('location', { length: 120 }),
  birthday: date('birthday'),
  birthdayVisibility: varchar('birthday_visibility', { length: 20 }).notNull().default('members'),
  // text, not varchar(512): an uploaded photo is stored as a small image data URL.
  avatarUrl: text('avatar_url'),
  pushSubscription: jsonb('push_subscription'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const birthdayWallPosts = pgTable(
  'birthday_wall_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    birthdayDate: date('birthday_date').notNull(),
    birthdayYear: integer('birthday_year').notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userYearIdx: uniqueIndex('birthday_wall_posts_user_year_idx').on(table.userId, table.birthdayYear),
    birthdayDateIdx: index('birthday_wall_posts_birthday_date_idx').on(table.birthdayDate),
    createdAtIdx: index('birthday_wall_posts_created_at_idx').on(table.createdAt),
  }),
);

export const bibleBooks = pgTable('bible_books', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  abbreviation: varchar('abbreviation', { length: 10 }).notNull(),
  testament: testamentEnum('testament').notNull(),
});

export const bibleVerses = pgTable(
  'bible_verses',
  {
    id: serial('id').primaryKey(),
    bookId: integer('book_id')
      .notNull()
      .references(() => bibleBooks.id),
    chapter: integer('chapter').notNull(),
    verseNumber: integer('verse_number').notNull(),
    text: text('text').notNull(),
    translation: varchar('translation', { length: 10 }).notNull().default('KJV'),
    embedding: jsonb('embedding'),
  },
  (table) => ({
    bookChapterVerseIdx: uniqueIndex('bible_verses_book_chapter_verse_idx').on(
      table.bookId,
      table.chapter,
      table.verseNumber,
      table.translation,
    ),
    chapterIdx: index('bible_verses_chapter_idx').on(table.bookId, table.chapter),
  }),
);

export const verseSchedule = pgTable('verse_schedule', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull().unique(),
  verseId: integer('verse_id')
    .notNull()
    .references(() => bibleVerses.id),
  mode: verseModeEnum('mode').notNull().default('manual'),
  bookId: integer('book_id').references(() => bibleBooks.id),
  chapter: integer('chapter'),
  sequenceIndex: integer('sequence_index'),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  pastoralNote: text('pastoral_note'),
});

export const verseReadings = pgTable(
  'verse_readings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    verseScheduleId: uuid('verse_schedule_id')
      .notNull()
      .references(() => verseSchedule.id),
    readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userVerseIdx: uniqueIndex('verse_readings_user_verse_idx').on(
      table.userId,
      table.verseScheduleId,
    ),
  }),
);

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 80 }).notNull(),
    targetType: varchar('target_type', { length: 80 }).notNull(),
    targetId: varchar('target_id', { length: 255 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index('admin_audit_logs_created_at_idx').on(table.createdAt),
    actorIdx: index('admin_audit_logs_actor_idx').on(table.actorUserId),
  }),
);

export const favoriteVerses = pgTable(
  'favorite_verses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    verseId: integer('verse_id')
      .notNull()
      .references(() => bibleVerses.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userVerseIdx: uniqueIndex('favorite_verses_user_verse_idx').on(table.userId, table.verseId),
    userIdx: index('favorite_verses_user_idx').on(table.userId),
  }),
);

export const verseReflections = pgTable(
  'verse_reflections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    verseId: integer('verse_id')
      .notNull()
      .references(() => bibleVerses.id),
    verseScheduleId: uuid('verse_schedule_id').references(() => verseSchedule.id),
    circleId: uuid('circle_id').references(() => circles.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('verse_reflections_user_idx').on(table.userId),
    verseIdx: index('verse_reflections_verse_idx').on(table.verseId),
  }),
);

export const prayerRequests = pgTable(
  'prayer_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 120 }).notNull(),
    content: text('content').notNull(),
    status: prayerStatusEnum('status').notNull().default('open'),
    type: varchar('type', { length: 20 }).notNull().default('request'),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    circleId: uuid('circle_id').references(() => circles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
  },
  (table) => ({
    userStatusIdx: index('prayer_requests_user_status_idx').on(table.userId, table.status),
  }),
);

export const prayerJoins = pgTable(
  'prayer_joins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    prayerRequestId: uuid('prayer_request_id')
      .notNull()
      .references(() => prayerRequests.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userRequestIdx: uniqueIndex('prayer_joins_user_request_idx').on(table.userId, table.prayerRequestId),
    requestIdIdx: index('prayer_joins_request_id_idx').on(table.prayerRequestId),
  }),
);

export const circles = pgTable('circles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userCircles = pgTable(
  'user_circles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCircleIdx: uniqueIndex('user_circles_user_circle_idx').on(table.userId, table.circleId),
  }),
);

export const sermons = pgTable('sermons', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  preacher: varchar('preacher', { length: 120 }).notNull(),
  date: date('date').notNull(),
  outline: text('outline').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userSermonNotes = pgTable(
  'user_sermon_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sermonId: uuid('sermon_id')
      .notNull()
      .references(() => sermons.id, { onDelete: 'cascade' }),
    notes: text('notes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userSermonIdx: uniqueIndex('user_sermon_notes_user_sermon_idx').on(table.userId, table.sermonId),
  }),
);

export const triviaQuestions = pgTable('trivia_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  options: jsonb('options').notNull(),
  correctOptionIndex: integer('correct_option_index').notNull(),
  explanation: text('explanation'),
  weekDate: date('week_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userTriviaResponses = pgTable(
  'user_trivia_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => triviaQuestions.id, { onDelete: 'cascade' }),
    selectedOptionIndex: integer('selected_option_index').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userQuestionIdx: uniqueIndex('user_trivia_responses_user_question_idx').on(table.userId, table.questionId),
  }),
);

export const scheduledPushNotifications = pgTable(
  'scheduled_push_notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 80 }).notNull(),
    body: text('body').notNull(),
    url: varchar('url', { length: 512 }),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
    status: scheduledPushStatusEnum('status').notNull().default('scheduled'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusScheduledForIdx: index('scheduled_push_status_scheduled_for_idx').on(
      table.status,
      table.scheduledFor,
    ),
  }),
);

// ── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  readings: many(verseReadings),
  reflections: many(verseReflections),
  favoriteVerses: many(favoriteVerses),
  prayerRequests: many(prayerRequests),
  prayerJoins: many(prayerJoins),
  birthdayPosts: many(birthdayWallPosts),
}));

export const birthdayWallPostsRelations = relations(birthdayWallPosts, ({ one }) => ({
  user: one(users, { fields: [birthdayWallPosts.userId], references: [users.id] }),
}));

export const bibleBooksRelations = relations(bibleBooks, ({ many }) => ({
  verses: many(bibleVerses),
}));

export const bibleVersesRelations = relations(bibleVerses, ({ one }) => ({
  book: one(bibleBooks, { fields: [bibleVerses.bookId], references: [bibleBooks.id] }),
}));

export const verseScheduleRelations = relations(verseSchedule, ({ one, many }) => ({
  verse: one(bibleVerses, { fields: [verseSchedule.verseId], references: [bibleVerses.id] }),
  book: one(bibleBooks, { fields: [verseSchedule.bookId], references: [bibleBooks.id] }),
  readings: many(verseReadings),
}));

export const verseReadingsRelations = relations(verseReadings, ({ one }) => ({
  user: one(users, { fields: [verseReadings.userId], references: [users.id] }),
  schedule: one(verseSchedule, {
    fields: [verseReadings.verseScheduleId],
    references: [verseSchedule.id],
  }),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  actor: one(users, { fields: [adminAuditLogs.actorUserId], references: [users.id] }),
}));

export const favoriteVersesRelations = relations(favoriteVerses, ({ one }) => ({
  user: one(users, { fields: [favoriteVerses.userId], references: [users.id] }),
  verse: one(bibleVerses, { fields: [favoriteVerses.verseId], references: [bibleVerses.id] }),
}));

export const verseReflectionsRelations = relations(verseReflections, ({ one }) => ({
  user: one(users, { fields: [verseReflections.userId], references: [users.id] }),
  verse: one(bibleVerses, { fields: [verseReflections.verseId], references: [bibleVerses.id] }),
  schedule: one(verseSchedule, {
    fields: [verseReflections.verseScheduleId],
    references: [verseSchedule.id],
  }),
}));

export const prayerRequestsRelations = relations(prayerRequests, ({ one, many }) => ({
  user: one(users, { fields: [prayerRequests.userId], references: [users.id] }),
  joins: many(prayerJoins),
}));

export const prayerJoinsRelations = relations(prayerJoins, ({ one }) => ({
  user: one(users, { fields: [prayerJoins.userId], references: [users.id] }),
  prayerRequest: one(prayerRequests, { fields: [prayerJoins.prayerRequestId], references: [prayerRequests.id] }),
}));

export const scheduledPushNotificationsRelations = relations(scheduledPushNotifications, ({ one }) => ({
  createdBy: one(users, {
    fields: [scheduledPushNotifications.createdByUserId],
    references: [users.id],
  }),
}));

// ── SMS & visitors ──────────────────────────────────────────────────────────
// New tables only (no columns added to `users`), so deploying the code before the
// migration is applied cannot break any existing query.

/** People who attended but are not (yet) app members. Phone is stored in E.164. */
export const visitors = pgTable(
  'visitors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }),
    invitedBy: varchar('invited_by', { length: 255 }),
    notes: text('notes'),
    firstVisitDate: date('first_visit_date').notNull(),
    lastVisitDate: date('last_visit_date').notNull(),
    visitCount: integer('visit_count').notNull().default(1),
    smsConsent: boolean('sms_consent').notNull().default(false),
    smsConsentAt: timestamp('sms_consent_at', { withTimezone: true }),
    welcomeSentAt: timestamp('welcome_sent_at', { withTimezone: true }),
    // new | contacted | returning | member
    followupStatus: varchar('followup_status', { length: 20 }).notNull().default('new'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneIdx: uniqueIndex('visitors_phone_idx').on(table.phone),
    lastVisitIdx: index('visitors_last_visit_idx').on(table.lastVisitDate),
  }),
);

/** One row per day a visitor attended; the unique index makes recording a visit idempotent. */
export const visitorVisits = pgTable(
  'visitor_visits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    visitorId: uuid('visitor_id')
      .notNull()
      .references(() => visitors.id, { onDelete: 'cascade' }),
    visitDate: date('visit_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    visitorDayIdx: uniqueIndex('visitor_visits_visitor_day_idx').on(table.visitorId, table.visitDate),
  }),
);

/** A member's own SMS opt-ins. Every topic defaults to off: nobody is texted without choosing it. */
export const smsConsents = pgTable('sms_consents', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  announcements: boolean('announcements').notNull().default(false),
  dailyVerse: boolean('daily_verse').notNull().default(false),
  birthday: boolean('birthday').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Numbers that replied STOP. Checked before every send, whatever consent says. */
export const smsOptOuts = pgTable('sms_opt_outs', {
  phone: varchar('phone', { length: 20 }).primaryKey(),
  source: varchar('source', { length: 30 }).notNull().default('stop_keyword'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Leader-edited wording for the standing texts. A missing row means "use the built-in default". */
export const messageTemplates = pgTable('message_templates', {
  key: varchar('key', { length: 30 }).primaryKey(),
  body: text('body').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Every message attempt (sent, dry-run, blocked or failed): the audit trail and the spend meter. */
export const messageLog = pgTable(
  'message_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: varchar('channel', { length: 20 }).notNull().default('sms'),
    // visitor_welcome | birthday | announcement | daily_verse | test
    purpose: varchar('purpose', { length: 30 }).notNull(),
    recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
    recipientUserId: uuid('recipient_user_id').references(() => users.id, { onDelete: 'set null' }),
    recipientVisitorId: uuid('recipient_visitor_id').references(() => visitors.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    segments: integer('segments').notNull(),
    // sent | delivered | failed | blocked | dry_run
    status: varchar('status', { length: 20 }).notNull(),
    provider: varchar('provider', { length: 20 }).notNull(),
    providerMessageId: varchar('provider_message_id', { length: 100 }),
    error: text('error'),
    costEstimateUsd: numeric('cost_estimate_usd', { precision: 10, scale: 4 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index('message_log_created_at_idx').on(table.createdAt),
    providerMessageIdx: index('message_log_provider_message_idx').on(table.providerMessageId),
    purposeUserIdx: index('message_log_purpose_user_idx').on(table.purpose, table.recipientUserId, table.createdAt),
  }),
);
