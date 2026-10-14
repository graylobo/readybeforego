-- 게시글 검색(부분 일치) 인덱스(gin_trgm_ops)에 필요한 확장
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- 고유 인덱스를 만들기 전에 같은 사람의 중복 반응/스크랩을 하나만 남긴다 (가장 최근 것 유지)
DELETE FROM post_reactions a USING post_reactions b
  WHERE a.user_id IS NOT NULL AND a.user_id = b.user_id AND a.post_id = b.post_id
    AND (a.created_at, a.id) < (b.created_at, b.id);--> statement-breakpoint
DELETE FROM post_reactions a USING post_reactions b
  WHERE a.user_id IS NULL AND b.user_id IS NULL AND a.ip_address = b.ip_address AND a.post_id = b.post_id
    AND (a.created_at, a.id) < (b.created_at, b.id);--> statement-breakpoint
DELETE FROM comment_reactions a USING comment_reactions b
  WHERE a.user_id IS NOT NULL AND a.user_id = b.user_id AND a.comment_id = b.comment_id
    AND (a.created_at, a.id) < (b.created_at, b.id);--> statement-breakpoint
DELETE FROM comment_reactions a USING comment_reactions b
  WHERE a.user_id IS NULL AND b.user_id IS NULL AND a.ip_address = b.ip_address AND a.comment_id = b.comment_id
    AND (a.created_at, a.id) < (b.created_at, b.id);--> statement-breakpoint
DELETE FROM post_scraps a USING post_scraps b
  WHERE a.user_id = b.user_id AND a.post_id = b.post_id
    AND (a.created_at, a.id) < (b.created_at, b.id);--> statement-breakpoint
CREATE TYPE "public"."board_manager_role" AS ENUM('manager', 'sub_manager');--> statement-breakpoint
CREATE TYPE "public"."board_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "board_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "board_manager_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"reason" text,
	"status" "board_request_status" DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"board_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid,
	"target_name" text,
	"source_post_id" text NOT NULL,
	"source_url" text NOT NULL,
	"original_title" text NOT NULL,
	"created_post_id" uuid,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preserved_terms" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_type" text DEFAULT 'dcinside' NOT NULL,
	"gallery_id" text NOT NULL,
	"target_board_id" uuid NOT NULL,
	"category" text,
	"min_recommend_count" integer DEFAULT 0 NOT NULL,
	"bot_user_id" uuid,
	"prompt_tone" text DEFAULT 'natural',
	"preserved_terms" text,
	"exclude_keywords" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"collect_limit" integer DEFAULT 5 NOT NULL,
	"enable_comments" boolean DEFAULT true NOT NULL,
	"comments_count" integer DEFAULT 2 NOT NULL,
	"comments_count_min" integer DEFAULT 0 NOT NULL,
	"comments_count_max" integer DEFAULT 3 NOT NULL,
	"view_count_min" integer DEFAULT 5 NOT NULL,
	"view_count_max" integer DEFAULT 15 NOT NULL,
	"include_images" boolean DEFAULT true NOT NULL,
	"author_main_keywords" text,
	"author_sub_keywords" text,
	"author_use_sub" boolean DEFAULT false NOT NULL,
	"comment_author_main_keywords" text,
	"comment_author_sub_keywords" text,
	"comment_author_use_sub" boolean DEFAULT false NOT NULL,
	"time_jitter_min_minutes" integer DEFAULT 10 NOT NULL,
	"time_jitter_max_minutes" integer DEFAULT 120 NOT NULL,
	"post_order_mode" text DEFAULT 'ordered' NOT NULL,
	"only_new_posts" boolean DEFAULT false NOT NULL,
	"new_posts_after_id" bigint,
	"crawl_direction" text DEFAULT 'newest' NOT NULL,
	"page_min" integer DEFAULT 1 NOT NULL,
	"page_max" integer DEFAULT 3 NOT NULL,
	"crawl_interval_minutes" integer DEFAULT 10 NOT NULL,
	"crawl_interval_max_minutes" integer,
	"auto_stop_minutes" integer DEFAULT 0 NOT NULL,
	"activated_at" timestamp,
	"last_crawled_at" timestamp,
	"next_crawl_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "comment_reactions_comment_user_idx";--> statement-breakpoint
DROP INDEX "post_reactions_post_user_idx";--> statement-breakpoint
DROP INDEX "post_scraps_user_post_idx";--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "is_read_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "show_managers" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "dislike_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "dislike_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "has_image" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "hidden_at" timestamp;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "show_all_board_menu" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "show_board_directory_menu" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "board_managers" ADD CONSTRAINT "board_managers_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_managers" ADD CONSTRAINT "board_managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_requests" ADD CONSTRAINT "board_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_requests" ADD CONSTRAINT "board_requests_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_requests" ADD CONSTRAINT "board_requests_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_logs" ADD CONSTRAINT "crawler_logs_target_id_crawler_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."crawler_targets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_logs" ADD CONSTRAINT "crawler_logs_created_post_id_posts_id_fk" FOREIGN KEY ("created_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_targets" ADD CONSTRAINT "crawler_targets_target_board_id_boards_id_fk" FOREIGN KEY ("target_board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler_targets" ADD CONSTRAINT "crawler_targets_bot_user_id_users_id_fk" FOREIGN KEY ("bot_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_managers_board_user_idx" ON "board_managers" USING btree ("board_id","user_id");--> statement-breakpoint
CREATE INDEX "board_managers_user_idx" ON "board_managers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "board_requests_status_idx" ON "board_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "board_requests_requester_idx" ON "board_requests" USING btree ("requester_id","created_at");--> statement-breakpoint
CREATE INDEX "crawler_logs_target_source_idx" ON "crawler_logs" USING btree ("target_id","source_post_id");--> statement-breakpoint
CREATE INDEX "crawler_logs_source_post_idx" ON "crawler_logs" USING btree ("source_post_id");--> statement-breakpoint
CREATE INDEX "crawler_logs_created_at_idx" ON "crawler_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "crawler_targets_board_idx" ON "crawler_targets" USING btree ("target_board_id");--> statement-breakpoint
CREATE INDEX "crawler_targets_gallery_idx" ON "crawler_targets" USING btree ("source_type","gallery_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reactions_comment_user_uniq" ON "comment_reactions" USING btree ("comment_id","user_id") WHERE "comment_reactions"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reactions_comment_ip_uniq" ON "comment_reactions" USING btree ("comment_id","ip_address") WHERE "comment_reactions"."user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_post_user_uniq" ON "post_reactions" USING btree ("post_id","user_id") WHERE "post_reactions"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "post_reactions_post_ip_uniq" ON "post_reactions" USING btree ("post_id","ip_address") WHERE "post_reactions"."user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "post_scraps_user_post_uniq" ON "post_scraps" USING btree ("user_id","post_id");--> statement-breakpoint
CREATE INDEX "post_scraps_user_created_idx" ON "post_scraps" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_all_list_idx" ON "posts" USING btree ("is_notice","is_pinned","created_at") WHERE "posts"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "posts_sitemap_idx" ON "posts" USING btree ("created_at","id") WHERE "posts"."deleted_at" is null and "posts"."is_bot" = false;--> statement-breakpoint
CREATE INDEX "posts_title_trgm_idx" ON "posts" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "posts_content_trgm_idx" ON "posts" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "posts_guest_name_trgm_idx" ON "posts" USING gin ("guest_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "users_name_trgm_idx" ON "users" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
-- 새로 추가한 추천/비추천 수, 이미지 여부를 기존 데이터 기준으로 채운다
UPDATE posts p SET
    like_count = r.likes,
    dislike_count = r.dislikes
  FROM (
    SELECT post_id,
           COUNT(*) FILTER (WHERE type = 'like')::int AS likes,
           COUNT(*) FILTER (WHERE type = 'dislike')::int AS dislikes
    FROM post_reactions GROUP BY post_id
  ) r
  WHERE r.post_id = p.id;--> statement-breakpoint
UPDATE comments c SET
    like_count = r.likes,
    dislike_count = r.dislikes
  FROM (
    SELECT comment_id,
           COUNT(*) FILTER (WHERE type = 'like')::int AS likes,
           COUNT(*) FILTER (WHERE type = 'dislike')::int AS dislikes
    FROM comment_reactions GROUP BY comment_id
  ) r
  WHERE r.comment_id = c.id;--> statement-breakpoint
UPDATE posts SET has_image = true
  WHERE content ~* '<img[^>]+src=[^>]+>' OR content ~ '!\[[^]]*\]\([^)]+\)';
