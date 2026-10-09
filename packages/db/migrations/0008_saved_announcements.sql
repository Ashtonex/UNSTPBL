-- Announcements a leader saved so they can be reused instead of retyped.
-- New table only: nothing existing is altered.

CREATE TABLE IF NOT EXISTS "saved_announcements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(80) NOT NULL,
  "body" text NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "saved_announcements_created_idx" ON "saved_announcements" ("created_at");
