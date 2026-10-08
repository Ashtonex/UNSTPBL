-- An uploaded profile photo is stored as a small image data URL (a few kB to
-- ~60 kB, bounded by the API), which does not fit in varchar(512). Widen the
-- column. varchar -> text is a metadata-only change in Postgres: no table
-- rewrite and existing values are untouched.
ALTER TABLE "users" ALTER COLUMN "avatar_url" TYPE text;
