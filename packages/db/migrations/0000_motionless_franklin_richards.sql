DO $$ BEGIN
 CREATE TYPE "public"."testament" AS ENUM('old', 'new');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('member', 'bishop', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."verse_mode" AS ENUM('manual', 'sequential');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bible_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"abbreviation" varchar(10) NOT NULL,
	"testament" "testament" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bible_verses" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"chapter" integer NOT NULL,
	"verse_number" integer NOT NULL,
	"text" text NOT NULL,
	"translation" varchar(10) DEFAULT 'KJV' NOT NULL,
	"embedding" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"display_name" varchar(255),
	"congregation" varchar(255),
	"translation" varchar(10) DEFAULT 'KJV' NOT NULL,
	"push_subscription" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verse_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"verse_schedule_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verse_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"verse_id" integer NOT NULL,
	"mode" "verse_mode" DEFAULT 'manual' NOT NULL,
	"book_id" integer,
	"chapter" integer,
	"sequence_index" integer,
	"dispatched_at" timestamp with time zone,
	CONSTRAINT "verse_schedule_date_unique" UNIQUE("date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bible_verses" ADD CONSTRAINT "bible_verses_book_id_bible_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."bible_books"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_readings" ADD CONSTRAINT "verse_readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_readings" ADD CONSTRAINT "verse_readings_verse_schedule_id_verse_schedule_id_fk" FOREIGN KEY ("verse_schedule_id") REFERENCES "public"."verse_schedule"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_schedule" ADD CONSTRAINT "verse_schedule_verse_id_bible_verses_id_fk" FOREIGN KEY ("verse_id") REFERENCES "public"."bible_verses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verse_schedule" ADD CONSTRAINT "verse_schedule_book_id_bible_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."bible_books"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bible_verses_book_chapter_verse_idx" ON "bible_verses" USING btree ("book_id","chapter","verse_number","translation");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bible_verses_chapter_idx" ON "bible_verses" USING btree ("book_id","chapter");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "verse_readings_user_verse_idx" ON "verse_readings" USING btree ("user_id","verse_schedule_id");