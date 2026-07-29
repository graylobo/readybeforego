CREATE TABLE "country_user_tip_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tip_id" uuid NOT NULL,
	"user_id" uuid,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "country_user_tip_likes" ADD CONSTRAINT "country_user_tip_likes_tip_id_country_user_tips_id_fk" FOREIGN KEY ("tip_id") REFERENCES "public"."country_user_tips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_user_tip_likes" ADD CONSTRAINT "country_user_tip_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "country_user_tip_likes_idx" ON "country_user_tip_likes" USING btree ("tip_id","user_id","ip_address");