CREATE TABLE "scam_sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scam_info_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"seen_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scam_sightings" ADD CONSTRAINT "scam_sightings_scam_info_id_scam_infos_id_fk" FOREIGN KEY ("scam_info_id") REFERENCES "public"."scam_infos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scam_sightings" ADD CONSTRAINT "scam_sightings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scam_sightings_scam_user_unique" ON "scam_sightings" USING btree ("scam_info_id","user_id");--> statement-breakpoint
CREATE INDEX "scam_sightings_scam_seen_idx" ON "scam_sightings" USING btree ("scam_info_id","seen_on");