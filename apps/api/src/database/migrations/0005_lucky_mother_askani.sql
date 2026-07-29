CREATE TABLE "country_guides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"is_checkable" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_user_tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"user_id" uuid,
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "country_guides" ADD CONSTRAINT "country_guides_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_user_tips" ADD CONSTRAINT "country_user_tips_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_user_tips" ADD CONSTRAINT "country_user_tips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "country_guides_country_idx" ON "country_guides" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "country_guides_category_idx" ON "country_guides" USING btree ("category");--> statement-breakpoint
CREATE INDEX "country_user_tips_country_idx" ON "country_user_tips" USING btree ("country_code");