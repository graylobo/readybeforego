ALTER TABLE "crawler_settings" ADD COLUMN "exclude_keywords" text;--> statement-breakpoint
ALTER TABLE "crawler_targets" ADD COLUMN "comment_prompt_tone" text;--> statement-breakpoint
ALTER TABLE "crawler_targets" ADD COLUMN "exclude_ip_mentions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "all_board_name" text DEFAULT '전체 게시판' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "all_board_description" text DEFAULT '모든 게시판의 최신 글' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "all_board_view_mode" text DEFAULT 'list' NOT NULL;