ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(40);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" varchar(120);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthday" date;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "birthday_visibility" varchar(20) NOT NULL DEFAULT 'members';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" varchar(512);

CREATE TABLE IF NOT EXISTS "birthday_wall_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "birthday_date" date NOT NULL,
  "birthday_year" integer NOT NULL,
  "message" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "birthday_wall_posts_user_year_idx"
  ON "birthday_wall_posts" ("user_id", "birthday_year");

CREATE INDEX IF NOT EXISTS "birthday_wall_posts_birthday_date_idx"
  ON "birthday_wall_posts" ("birthday_date");

CREATE INDEX IF NOT EXISTS "birthday_wall_posts_created_at_idx"
  ON "birthday_wall_posts" ("created_at");
