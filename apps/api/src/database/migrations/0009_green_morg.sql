ALTER TABLE "country_guides" ADD COLUMN "city_id" uuid;--> statement-breakpoint
ALTER TABLE "country_guides" ADD CONSTRAINT "country_guides_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "country_guides_city_idx" ON "country_guides" USING btree ("city_id");