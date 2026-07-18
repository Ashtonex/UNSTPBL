ALTER TABLE "prayer_requests" ADD COLUMN "type" varchar(20) DEFAULT 'request' NOT NULL;--> statement-breakpoint
ALTER TABLE "prayer_requests" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;