-- New staff roles. Existing members, bishops and admins are unchanged: these only add
-- values a person can be given from the Admin page.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'usher';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'pastor';
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'communications';
