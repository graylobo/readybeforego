CREATE TYPE "public"."scam_scope" AS ENUM('spot', 'city', 'country');--> statement-breakpoint
ALTER TABLE "scam_infos" ALTER COLUMN "region_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scam_infos" ADD COLUMN "city_id" uuid;--> statement-breakpoint
ALTER TABLE "scam_infos" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "scam_infos" ADD COLUMN "scope" "scam_scope" DEFAULT 'spot' NOT NULL;--> statement-breakpoint
ALTER TABLE "scam_infos" ADD CONSTRAINT "scam_infos_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scam_infos" ADD CONSTRAINT "scam_infos_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scam_infos_city_idx" ON "scam_infos" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "scam_infos_country_idx" ON "scam_infos" USING btree ("country_code");