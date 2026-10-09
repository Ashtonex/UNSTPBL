-- Lets a member choose how their texts are delivered: plain SMS (works without data) or
-- WhatsApp (cheaper, needs data). Existing members stay on SMS. message_log already has a
-- "channel" column, so WhatsApp messages are logged there too.

ALTER TABLE "sms_consents" ADD COLUMN IF NOT EXISTS "preferred_channel" varchar(10) NOT NULL DEFAULT 'sms';
