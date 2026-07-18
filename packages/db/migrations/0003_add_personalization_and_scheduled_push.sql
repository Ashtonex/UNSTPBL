DO $$ BEGIN
 CREATE TYPE "public"."prayer_status" AS ENUM('open', 'answered');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."scheduled_push_status" AS ENUM('scheduled', 'sent', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "favorite_verses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "verse_id" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verse_reflections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "verse_id" integer NOT NULL,
  "verse_schedule_id" uuid,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prayer_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "title" varchar(120) NOT NULL,
  "content" text NOT NULL,
  "status" "prayer_status" DEFAULT 'open' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_push_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "title" varchar(80) NOT NULL,
  "body" text NOT NULL,
  "url" varchar(512),
  "scheduled_for" timestamp with time zone NOT NULL,
  "status" "scheduled_push_status" DEFAULT 'scheduled' NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorite_verses" ADD CONSTRAINT "favorite_verses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "favorite_verses" ADD CONSTRAINT "favorite_verses_verse_id_bible_verses_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."bible_verses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_reflections" ADD CONSTRAINT "verse_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_reflections" ADD CONSTRAINT "verse_reflections_verse_id_bible_verses_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."bible_verses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_reflections" ADD CONSTRAINT "verse_reflections_verse_schedule_id_verse_schedule_id_fk" FOREIGN KEY ("verse_schedule_id") REFERENCES "public"."verse_schedule"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prayer_requests" ADD CONSTRAINT "prayer_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_push_notifications" ADD CONSTRAINT "scheduled_push_notifications_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "favorite_verses_user_verse_idx" ON "favorite_verses" USING btree ("user_id","verse_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "favorite_verses_user_idx" ON "favorite_verses" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verse_reflections_user_idx" ON "verse_reflections" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verse_reflections_verse_idx" ON "verse_reflections" USING btree ("verse_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prayer_requests_user_status_idx" ON "prayer_requests" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_push_status_scheduled_for_idx" ON "scheduled_push_notifications" USING btree ("status","scheduled_for");
