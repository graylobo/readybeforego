CREATE TYPE "public"."report_type" AS ENUM('CAUTION', 'TIP', 'INFO');--> statement-breakpoint
ALTER TABLE "scam_infos" ADD COLUMN "report_type" "report_type" DEFAULT 'CAUTION' NOT NULL;--> statement-breakpoint
CREATE INDEX "scam_infos_report_type_idx" ON "scam_infos" USING btree ("report_type");