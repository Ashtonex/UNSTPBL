-- Editable wording for the standing texts (visitor thank-you, birthday, daily verse).
-- New table only: nothing existing is altered. No row means "use the built-in default",
-- so the app works unchanged whether or not this has been applied.

CREATE TABLE IF NOT EXISTS "message_templates" (
  "key" varchar(30) PRIMARY KEY NOT NULL,
  "body" text NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
