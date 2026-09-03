CREATE TYPE "public"."chat_author_type" AS ENUM('member', 'guest');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"room_slug" text DEFAULT 'lobby' NOT NULL,
	"author_type" "chat_author_type" NOT NULL,
	"user_id" uuid,
	"guest_id" text,
	"nickname" text NOT NULL,
	"content" text NOT NULL,
	"reply_to_id" uuid,
	"reply_to_nickname" text,
	"reply_to_content" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"persist_enabled" boolean DEFAULT true NOT NULL,
	"show_online_count" boolean DEFAULT false NOT NULL,
	"show_message_time" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_reply_to_id_chat_messages_id_fk" FOREIGN KEY ("reply_to_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_room_created_idx" ON "chat_messages" USING btree ("room_slug","created_at");