ALTER TABLE "scam_infos" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "scam_infos" ADD CONSTRAINT "scam_infos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scam_infos_user_idx" ON "scam_infos" USING btree ("user_id");