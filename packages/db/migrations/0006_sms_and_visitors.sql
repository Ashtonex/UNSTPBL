-- SMS messaging and visitor follow-up. New tables only: nothing existing is altered,
-- so this is safe to apply before or after the code that uses it is deployed.

CREATE TABLE IF NOT EXISTS "visitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" varchar(255) NOT NULL,
  "phone" varchar(20) NOT NULL,
  "email" varchar(255),
  "invited_by" varchar(255),
  "notes" text,
  "first_visit_date" date NOT NULL,
  "last_visit_date" date NOT NULL,
  "visit_count" integer NOT NULL DEFAULT 1,
  "sms_consent" boolean NOT NULL DEFAULT false,
  "sms_consent_at" timestamp with time zone,
  "welcome_sent_at" timestamp with time zone,
  "followup_status" varchar(20) NOT NULL DEFAULT 'new',
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "visitors_phone_idx" ON "visitors" ("phone");
CREATE INDEX IF NOT EXISTS "visitors_last_visit_idx" ON "visitors" ("last_visit_date");

CREATE TABLE IF NOT EXISTS "visitor_visits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "visitor_id" uuid NOT NULL REFERENCES "visitors"("id") ON DELETE CASCADE,
  "visit_date" date NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "visitor_visits_visitor_day_idx" ON "visitor_visits" ("visitor_id", "visit_date");

CREATE TABLE IF NOT EXISTS "sms_consents" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "announcements" boolean NOT NULL DEFAULT false,
  "daily_verse" boolean NOT NULL DEFAULT false,
  "birthday" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sms_opt_outs" (
  "phone" varchar(20) PRIMARY KEY,
  "source" varchar(30) NOT NULL DEFAULT 'stop_keyword',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel" varchar(20) NOT NULL DEFAULT 'sms',
  "purpose" varchar(30) NOT NULL,
  "recipient_phone" varchar(20) NOT NULL,
  "recipient_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "recipient_visitor_id" uuid REFERENCES "visitors"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "segments" integer NOT NULL,
  "status" varchar(20) NOT NULL,
  "provider" varchar(20) NOT NULL,
  "provider_message_id" varchar(100),
  "error" text,
  "cost_estimate_usd" numeric(10, 4),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "message_log_created_at_idx" ON "message_log" ("created_at");
CREATE INDEX IF NOT EXISTS "message_log_provider_message_idx" ON "message_log" ("provider_message_id");
CREATE INDEX IF NOT EXISTS "message_log_purpose_user_idx" ON "message_log" ("purpose", "recipient_user_id", "created_at");
