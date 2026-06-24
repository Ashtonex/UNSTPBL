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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['member', 'bishop', 'admin']);
export const testamentEnum = pgEnum('testament', ['old', 'new']);
export const verseModeEnum = pgEnum('verse_mode', ['manual', 'sequential']);

// ── Tables ──────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // matches Supabase auth.users.id
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: userRoleEnum('role').notNull().default('member'),
  displayName: varchar('display_name', { length: 255 }),
  congregation: varchar('congregation', { length: 255 }),
  translation: varchar('translation', { length: 10 }).notNull().default('KJV'),
  pushSubscription: jsonb('push_subscription'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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

// ── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  readings: many(verseReadings),
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
