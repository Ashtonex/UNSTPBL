-- UNSTPBL Database Schema Migration
-- Creates all tables, enums, indexes, and RLS policies

-- ── Enums ───────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('member', 'bishop', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE testament AS ENUM ('old', 'new');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verse_mode AS ENUM ('manual', 'sequential');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,  -- matches Supabase auth.users.id
  email         VARCHAR(255) NOT NULL UNIQUE,
  role          user_role NOT NULL DEFAULT 'member',
  display_name  VARCHAR(255),
  congregation  VARCHAR(255),
  push_subscription JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bible_books (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  abbreviation  VARCHAR(10) NOT NULL,
  testament     testament NOT NULL
);

CREATE TABLE IF NOT EXISTS bible_verses (
  id            SERIAL PRIMARY KEY,
  book_id       INTEGER NOT NULL REFERENCES bible_books(id),
  chapter       INTEGER NOT NULL,
  verse_number  INTEGER NOT NULL,
  text          TEXT NOT NULL,
  translation   VARCHAR(10) NOT NULL DEFAULT 'KJV'
);

CREATE UNIQUE INDEX IF NOT EXISTS bible_verses_book_chapter_verse_idx
  ON bible_verses (book_id, chapter, verse_number, translation);

CREATE INDEX IF NOT EXISTS bible_verses_chapter_idx
  ON bible_verses (book_id, chapter);

CREATE TABLE IF NOT EXISTS verse_schedule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  verse_id        INTEGER NOT NULL REFERENCES bible_verses(id),
  mode            verse_mode NOT NULL DEFAULT 'manual',
  book_id         INTEGER REFERENCES bible_books(id),
  chapter         INTEGER,
  sequence_index  INTEGER,
  dispatched_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS verse_readings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  verse_schedule_id UUID NOT NULL REFERENCES verse_schedule(id),
  read_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS verse_readings_user_verse_idx
  ON verse_readings (user_id, verse_schedule_id);

-- ── Row Level Security ──────────────────────────────────────────────────────

-- Users: can read/update only their own row
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY users_insert_own ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Bible books: public read for authenticated users, no write from client
ALTER TABLE bible_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY bible_books_select ON bible_books
  FOR SELECT TO authenticated USING (true);

-- Bible verses: public read for authenticated users, no write from client
ALTER TABLE bible_verses ENABLE ROW LEVEL SECURITY;

CREATE POLICY bible_verses_select ON bible_verses
  FOR SELECT TO authenticated USING (true);

-- Verse schedule: any authenticated user can read, write only via service role
ALTER TABLE verse_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY verse_schedule_select ON verse_schedule
  FOR SELECT TO authenticated USING (true);

-- Verse readings: users can insert and read their own rows only
ALTER TABLE verse_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY verse_readings_select_own ON verse_readings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY verse_readings_insert_own ON verse_readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
