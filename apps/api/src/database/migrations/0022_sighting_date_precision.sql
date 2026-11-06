CREATE TYPE "public"."sighting_date_precision" AS ENUM('day', 'week', 'month');--> statement-breakpoint
ALTER TABLE "scam_sightings" ADD COLUMN "seen_precision" "sighting_date_precision" NOT NULL;