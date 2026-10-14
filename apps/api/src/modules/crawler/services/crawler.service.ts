import { Injectable, Logger, Inject } from '@nestjs/common';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import { UPLOAD_LIMITS, findExcludeKeyword, parseExcludeKeywords } from '@community/shared-types';
import { eq, and, desc, inArray, isNull, ne, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../database/schema';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { UploadsService } from '../../uploads/uploads.service';
import { LlmRewriterService } from './llm-rewriter.service';
import { LlmUnavailableError } from '../interfaces/llm-provider.interface';
import { sanitizeContent } from '../../../common/utils/html-sanitizer';
import { contentHasImage } from '../../../common/utils/content-has-image';
import { CrawlerSettingsRepository } from '../crawler-settings.repository';
import { mergePreservedTerms, parsePreservedTerms } from '../utils/term-protection';
import { pickNextCrawlAt } from '../utils/crawl-schedule';
import {
  AI_UNAVAILABLE_PREFIX,
  MAX_POST_ATTEMPTS,
  planPostTiming,
  resolvePostCreatedAt,
  toCrawlDirection,
  toPostOrderMode,
} from '../utils/post-timing';
import {
  CrawlResult,
  emptyCrawlResult,
} from '../interfaces/crawler-run.interface';
import { ParsedPostItem, PostDetail } from '../interfaces/crawler.interface';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';

const BOT_NICKNAMES = [
  '오크트롤',
  '입싸동기',
  '세계의섬',
  '니가가라',
  'm2주작풍',
  '투표는범죄',
  '달리는토끼',
  '골든핑거',
  '달콤한초코',
  '초록숲길',
];

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly uploadsService: UploadsService,
    private readonly llmRewriter: LlmRewriterService,
    private readonly crawlerSettings: CrawlerSettingsRepository,
  ) {}

  /**
   * 등록된 단일 갤러리 타겟에 대해 크롤링 및 발행 실행
   * (실행 락/중지 요청 처리는 CrawlerRunner 담당. signal이 중단되면 현재 단계가 끝나는 즉시 중단)
   */
  async crawlTarget(
    targetId: string,
    isManual: boolean,
    signal: AbortSignal,
  ): Promise<CrawlResult> {
    const target = await this.db.query.crawlerTargets.findFirst({
      where: eq(schema.crawlerTargets.id, targetId),
    });

    if (!target || (!target.isActive && !isManual)) {
      this.logger.warn(`Target ${targetId} not found or inactive`);
      return emptyCrawlResult();
    }

    this.logger.log(
      `Starting crawl for target "${target.name}" (Gallery: ${target.galleryId})`,
    );
    // 마지막 수집 시각은 끝난 시각이 아니라 시작한 시각으로 남긴다 (화면 표시, 다음 수집 시각의 기준)
    const startedAt = new Date();

    // 보존 단어 = 전체 공통 + 이 카드 (실행 시작 시 한 번만 읽는다)
    const { preservedTerms: commonPreservedTerms } =
      await this.crawlerSettings.getSettings();
    const preservedTerms = mergePreservedTerms(
      parsePreservedTerms(commonPreservedTerms),
      parsePreservedTerms(target.preservedTerms),
    );
    const excludeKeywords = parseExcludeKeywords(target.excludeKeywords);

    let collected = 0;
    let skipped = 0;
    let errors = 0;
    const skipDetails = {
      alreadyCollected: 0,
      imageFiltered: 0,
      keywordFiltered: 0,
      fetchFailed: 0,
      beforeStart: 0,
      retryExhausted: 0,
    };

    // '켠 이후 올라온 글만': 기준 글 번호가 아직 없으면(켤 때 디시 조회에 실패한 경우 등) 지금 정하고, 이번에는 수집하지 않는다
    const newPostsAfterId = target.onlyNewPosts ? target.newPostsAfterId : null;
    if (target.onlyNewPosts && newPostsAfterId == null) {
      const baseline = await this.captureNewPostsBaseline(target.id);
      await this.db
        .update(schema.crawlerTargets)
        .set({ lastCrawledAt: startedAt, updatedAt: new Date() })
        .where(eq(schema.crawlerTargets.id, target.id));
      return { ...emptyCrawlResult(), baselineCaptured: baseline != null };
    }

    // 1-1. 최신순으로 상위 적격 후보군 선별 (중복, 상세 조회 실패, 이미지 필터링 제외하여 collectLimit만큼 선별)
    interface ReadyCandidate {
      item: ParsedPostItem;
      detail: PostDetail;
      processedContent: string;
      // 후보 준비 단계에서 미리 업로드한 본문 이미지 (게시글로 저장되지 못하면 삭제)
      uploadedImagePaths: string[];
      saved: boolean;
    }
    const qualifiedCandidates: ReadyCandidate[] = [];

    try {
      // 수집할 페이지 범위 결정 (lowPage부터 highPage까지 순차 탐색하여 목표 수량 collectLimit 달성 시까지 수집)
      const minPage = target.pageMin ?? 1;
      const maxPage = target.pageMax ?? 1;
      const lowPage = Math.max(1, Math.min(minPage, maxPage));
      const highPage = Math.max(1, Math.max(minPage, maxPage));

      // 수집 방향: 최신 글부터면 1페이지 위쪽부터, 예전 글부터면 끝 페이지 아래쪽부터 본다
      const direction = toCrawlDirection(target.crawlDirection);
      const pages = Array.from({ length: highPage - lowPage + 1 }, (_, i) => lowPage + i);
      if (direction === 'oldest') pages.reverse();

      for (const currentPage of pages) {
        if (signal.aborted) {
          break;
        }
        if (qualifiedCandidates.length >= target.collectLimit) {
          break;
        }

        this.logger.log(
          `Crawling gallery ${target.galleryId} (Page: ${currentPage}/${highPage})`,
        );

        // 1. 목록 가져오기 (해당 페이지의 조건 만족 글 후보군 전체 파싱)
        const postItems = await this.fetchGalleryPostList(
          target.galleryId,
          target.minRecommendCount,
          currentPage,
        );

        this.logger.log(
          `Found ${postItems.length} candidate posts from gallery ${target.galleryId} (Page: ${currentPage})`,
        );

        // 목록은 최신 글부터라, 예전 글부터면 아래쪽부터 본다
        const orderedItems = direction === 'oldest' ? [...postItems].reverse() : postItems;
        // '켠 이후 올라온 글만'(최신 글부터): 켜기 전 글을 만나면 그 뒤와 다음 페이지는 모두 더 과거 글이다
        let reachedStartPoint = false;
        for (const [itemIndex, item] of orderedItems.entries()) {
          if (signal.aborted) {
            break;
          }
          if (qualifiedCandidates.length >= target.collectLimit) {
            break;
          }

          // '켠 이후 올라온 글만': 켜는 순간의 최신 글 번호 이하(그때 이미 있던 글)는 가져오지 않는다
          if (newPostsAfterId != null && Number(item.sourcePostId) <= newPostsAfterId) {
            if (direction === 'oldest') {
              // 예전 글부터 보는 중이면 이 뒤에 새 글이 나온다
              skipped++;
              skipDetails.beforeStart++;
              continue;
            }
            const remaining = orderedItems.length - itemIndex;
            skipped += remaining;
            skipDetails.beforeStart += remaining;
            reachedStartPoint = true;
            break;
          }

          // 중복 수집 여부 체크 (실패 기록만 있는 글은 다시 시도)
          const existingLog = await this.db.query.crawlerLogs.findFirst({
            where: and(
              eq(schema.crawlerLogs.targetId, target.id),
              eq(schema.crawlerLogs.sourcePostId, item.sourcePostId),
              ne(schema.crawlerLogs.status, 'FAILED'),
            ),
          });

          if (existingLog) {
            this.logger.log(
              `Skipping post ${item.sourcePostId}: Already collected previously.`,
            );
            skipped++;
            skipDetails.alreadyCollected++;
            continue;
          }

          // 이미 여러 번 실패한 글은 그만 시도한다 (AI가 응답했는데 검증에 계속 걸리면 매번 AI 비용이 든다)
          const [{ failures }] = await this.db
            .select({ failures: sql<number>`count(*)::int` })
            .from(schema.crawlerLogs)
            .where(
              and(
                eq(schema.crawlerLogs.targetId, target.id),
                eq(schema.crawlerLogs.sourcePostId, item.sourcePostId),
                eq(schema.crawlerLogs.status, 'FAILED'),
                sql`coalesce(${schema.crawlerLogs.errorMessage}, '') not like ${AI_UNAVAILABLE_PREFIX + '%'}`,
              ),
            );
          if (failures >= MAX_POST_ATTEMPTS) {
            skipped++;
            skipDetails.retryExhausted++;
            continue;
          }

          // 제목에 제외 키워드가 있으면 상세 조회도 하지 않는다
          const titleKeyword = findExcludeKeyword(excludeKeywords, item.title);
          if (titleKeyword) {
            this.logger.log(
              `Skipping post ${item.sourcePostId}: title contains exclude keyword "${titleKeyword}".`,
            );
            skipped++;
            skipDetails.keywordFiltered++;
            continue;
          }

          try {
            // 2. 글 상세 조회
            const postDetail = await this.fetchPostDetail(
              target.galleryId,
              item.sourcePostId,
              item.url,
              item.title,
            );
            if (!postDetail) {
              this.logger.warn(
                `Skipping post ${item.sourcePostId}: Failed to fetch post detail (deleted or blocked).`,
              );
              skipped++;
              skipDetails.fetchFailed++;
              continue;
            }

            // 제외 키워드 검사 (목록의 제목이 잘려 있을 수 있어 상세 제목도 본다. 본문은 HTML 태그를 뺀 글자만)
            const contentKeyword = findExcludeKeyword(
              excludeKeywords,
              postDetail.title,
              cheerio.load(postDetail.contentHtml).text(),
            );
            if (contentKeyword) {
              this.logger.log(
                `Skipping post ${item.sourcePostId}: contains exclude keyword "${contentKeyword}".`,
              );
              skipped++;
              skipDetails.keywordFiltered++;
              continue;
            }

            // 3. 이미지 포함 글 필터링 (includeImages가 false인 경우 이미지가 있는 글 스킵)
            const hasImages =
              postDetail.imageUrls.length > 0 ||
              postDetail.contentHtml.includes('<img') ||
              postDetail.contentHtml.includes('data-original');

            if (!target.includeImages && hasImages) {
              this.logger.log(
                `Skipping post ${item.sourcePostId} because it contains images and includeImages is false.`,
              );
              skipped++;
              skipDetails.imageFiltered++;
              continue;
            }

            // 4. 본문 내 이미지 자체 스토리지로 업로드 및 URL 교체
            const { html: processedContent, uploadedPaths } =
              await this.processImagesAndReplaceSrc(postDetail.contentHtml);

            qualifiedCandidates.push({
              item,
              detail: postDetail,
              processedContent,
              uploadedImagePaths: uploadedPaths,
              saved: false,
            });
          } catch (candidateErr) {
            this.logger.warn(
              `Failed during candidate prep for post ${item.sourcePostId}`,
              candidateErr,
            );
          }
        }
        if (reachedStartPoint) {
          break;
        }
      }

      this.logger.log(
        `Selected ${qualifiedCandidates.length} qualified posts across pages ${lowPage}~${highPage} for crawling queue.`,
      );

      // 1-2. 디시 원본의 최신 등록 순서(상단: 최신 → 하단: 과거)와 우리 게시판 노출 순서(최신순 DESC)가 일치하도록
      // 과거 글부터 먼저 등록하고 최신글을 가장 마지막에 등록 (역순 큐 처리)
      // 최신 글부터 모았으면 뒤집고, 예전 글부터 모았으면 그대로 (어느 쪽이든 오래된 글부터 등록)
      const executionQueue = direction === 'oldest' ? [...qualifiedCandidates] : [...qualifiedCandidates].reverse();

      // 등록 시각 계획: 순서 유지면 디시 순서대로(간격은 무작위), 섞기면 글마다 따로 (post-timing.ts)
      const timing = planPostTiming({
        count: executionQueue.length,
        minMinutes: target.timeJitterMinMinutes ?? 10,
        maxMinutes: target.timeJitterMaxMinutes ?? 120,
        mode: toPostOrderMode(target.postOrderMode),
      });
      const isRealtime = timing.isRealtime;
      // 순서 유지: 그 게시판에 앞서 등록한 봇 글보다 과거가 되지 않게 (1개씩 수집해도 순서 유지)
      let orderFloorMs: number | null = null;
      if (timing.mode === 'ordered' && executionQueue.length > 0) {
        const [last] = await this.db
          .select({ createdAt: schema.posts.createdAt })
          .from(schema.posts)
          .where(and(eq(schema.posts.boardId, target.targetBoardId), eq(schema.posts.isBot, true), isNull(schema.posts.deletedAt)))
          .orderBy(desc(schema.posts.createdAt))
          .limit(1);
        orderFloorMs = last?.createdAt ? last.createdAt.getTime() : null;
      }

      for (let qIdx = 0; qIdx < executionQueue.length; qIdx++) {
        if (signal.aborted) {
          break;
        }
        const {
          item,
          detail: postDetail,
          processedContent,
        } = executionQueue[qIdx];

        try {
          // 4-1. 해당 게시글에 생성할 댓글 수 계산 (최소~최대 범위 내 무작위, 0개면 무플로 처리)
          let shouldGenerateComments = false;
          let postCommentsCount = 0;
          if (target.enableComments) {
            const minCmt = target.commentsCountMin ?? 0;
            const maxCmt = target.commentsCountMax ?? target.commentsCount ?? 3;
            const lowCmt = Math.min(minCmt, maxCmt);
            const highCmt = Math.max(minCmt, maxCmt);
            postCommentsCount =
              Math.floor(Math.random() * (highCmt - lowCmt + 1)) + lowCmt;
            shouldGenerateComments = postCommentsCount > 0;
          }

          // 5. LLM 패러프레이징 및 자동 댓글 생성
          const rewritten = await this.llmRewriter.rewrite({
            title: postDetail.title,
            content: processedContent,
            promptTone: target.promptTone,
            preservedTerms,
            generateComments: shouldGenerateComments,
            commentsCount: postCommentsCount,
          });

          // LLM 응답 대기 중 중지 요청이 들어왔다면 게시글을 등록하지 않고 종료
          if (signal.aborted) {
            break;
          }

          // 6. 작성자 닉네임 배합 (메인 + 보조 또는 기본 봇 닉네임)
          const authorNickname = this.generateAuthorNickname(target);

          // 7-1. 초기 조회수 범위 계산
          const minView = target.viewCountMin ?? 5;
          const maxView = target.viewCountMax ?? 15;
          const rangeLow = Math.min(minView, maxView);
          const rangeHigh = Math.max(minView, maxView);
          const calculatedViewCount =
            Math.floor(Math.random() * (rangeHigh - rangeLow + 1)) + rangeLow;

          // 7-2. 등록 시각 (등록하는 순간 기준으로 계산해야 "방금 전"이 실제로 방금 전이 된다)
          const postCreatedAt = resolvePostCreatedAt({
            nowMs: Date.now(),
            offsetMs: timing.offsetsMs[qIdx],
            mode: timing.mode,
            floorMs: orderFloorMs,
          });

          // 8~10. 게시글·댓글·성공 기록을 하나의 트랜잭션으로 저장
          // (중간에 실패하면 모두 취소되어, 게시글은 등록됐는데 실패로 기록되는 상태가 생기지 않는다.
          //  실패 기록만 있는 글은 다음 수집 때 재시도하므로, 이 상태가 생기면 같은 글이 중복 등록된다)
          const insertedCommentsCount = await this.db.transaction(
            async (tx) => {
              // 8. 게시글 생성
              const sanitizedContent = sanitizeContent(rewritten.content);
              const [newPost] = await tx
                .insert(schema.posts)
                .values({
                  boardId: target.targetBoardId,
                  userId: target.botUserId || null,
                  guestName: target.botUserId ? null : authorNickname,
                  title: rewritten.title,
                  // 원문/LLM 응답 HTML이므로 사용자 글과 동일하게 정화한 뒤 저장 (본문은 HTML 그대로 렌더링됨)
                  content: sanitizedContent,
                  hasImage: contentHasImage(sanitizedContent),
                  category: target.category || null,
                  viewCount: calculatedViewCount,
                  isBot: true,
                  createdAt: postCreatedAt,
                  updatedAt: postCreatedAt,
                })
                .returning();

              // 9. 자동 댓글 등록 (enableComments 활성화 및 댓글이 생성된 경우)
              let insertedCommentsCount = 0;
              if (
                shouldGenerateComments &&
                rewritten.comments &&
                rewritten.comments.length > 0
              ) {
                // 목표 댓글 수(postCommentsCount)만큼만 엄격하게 제한 (LLM이 초과 생성하더라도 방어)
                const targetComments = rewritten.comments.slice(
                  0,
                  postCommentsCount,
                );
                const postTimeMs = postCreatedAt.getTime();
                const nowMs = Date.now();
                const availableDiffMs = Math.max(nowMs - postTimeMs, 60 * 1000);
                const commentIntervalMs = Math.floor(
                  availableDiffMs / (targetComments.length + 1),
                );

                for (let cIdx = 0; cIdx < targetComments.length; cIdx++) {
                  const cmt = targetComments[cIdx];
                  if (!cmt.content) continue;

                  // 댓글 작성자: 댓글 닉네임 배합 설정 적용 (없을 시 LLM 생성 닉네임 또는 봇 닉네임)
                  const commentAuthor = this.generateCommentAuthorNickname(
                    target,
                    cmt.nickname,
                  );

                  // 분산 시간이 0이면(실시간 등록 모드) 등록 직후 약간의 시차 부여, 과거 분산 모드면 과거 타임라인 배치
                  let commentCreatedAt: Date;
                  if (isRealtime) {
                    // 글 작성 시각 이후 10초 단위로 시차 부여 (현재 시각을 넘지 않도록 제한)
                    const commentTimeMs = Math.min(
                      postTimeMs + (cIdx + 1) * 10000,
                      Date.now(),
                    );
                    commentCreatedAt = new Date(commentTimeMs);
                  } else {
                    const randomOffset = Math.floor(
                      Math.random() * Math.max(1, commentIntervalMs * 0.3),
                    );
                    const commentTimeMs = Math.min(
                      postTimeMs +
                        commentIntervalMs * (cIdx + 1) +
                        randomOffset,
                      nowMs - 5000,
                    );
                    commentCreatedAt = new Date(commentTimeMs);
                  }

                  await tx.insert(schema.comments).values({
                    targetId: newPost.id,
                    targetType: 'post',
                    content: cmt.content,
                    guestName: commentAuthor,
                    createdAt: commentCreatedAt,
                    updatedAt: commentCreatedAt,
                  });
                  insertedCommentsCount++;
                }

                // 게시글의 commentCount 업데이트
                if (insertedCommentsCount > 0) {
                  await tx
                    .update(schema.posts)
                    .set({ commentCount: insertedCommentsCount })
                    .where(eq(schema.posts.id, newPost.id));
                }
              }

              // 10. 성공 로그 기록
              await tx.insert(schema.crawlerLogs).values({
                targetId: target.id,
                targetName: target.name,
                sourcePostId: item.sourcePostId,
                sourceUrl: item.url,
                originalTitle: postDetail.title,
                createdPostId: newPost.id,
                status: 'SUCCESS',
              });

              return insertedCommentsCount;
            },
          );
          executionQueue[qIdx].saved = true;
          if (timing.mode === 'ordered') orderFloorMs = postCreatedAt.getTime();

          collected++;
          this.logger.log(
            `Successfully collected: "${rewritten.title}" by ${authorNickname} (Comments: ${insertedCommentsCount})`,
          );

          // 디시인사이드 IP 차단 방지 및 LLM Rate Limit 방지를 위한 요청 간 딜레이 (2초)
          await this.sleep(2000, signal);
        } catch (postError) {
          errors++;
          this.logger.error(
            `Failed to process post ${item.sourcePostId}`,
            postError,
          );
          await this.db.insert(schema.crawlerLogs).values({
            targetId: target.id,
            targetName: target.name,
            sourcePostId: item.sourcePostId,
            sourceUrl: item.url,
            originalTitle: item.title,
            status: 'FAILED',
            // AI 자체를 못 쓴 실패는 표시해 둬서 '실패 3회' 횟수에 세지 않는다
            errorMessage:
              (postError instanceof LlmUnavailableError ? AI_UNAVAILABLE_PREFIX : '') +
              (postError instanceof Error ? postError.message : String(postError)),
          });
          // AI를 못 쓰는 상태면 남은 글도 똑같이 실패하므로 이번 수집은 여기서 멈춘다 (남은 글은 다음 수집 때 다시 후보가 됨)
          if (postError instanceof LlmUnavailableError) {
            this.logger.warn(`AI 재작성을 쓸 수 없어 이번 수집을 멈춥니다: ${postError.message}`);
            break;
          }
        }
      }

      // 마지막 크롤링 시각 업데이트 (직접 실행한 수집도 정기 수집처럼 다음 수집 시각을 다시 정한다. 정기 수집은 시작 전에 이미 정함)
      await this.db
        .update(schema.crawlerTargets)
        .set({
          lastCrawledAt: startedAt,
          ...(isManual && {
            nextCrawlAt: pickNextCrawlAt(startedAt.getTime(), target.crawlIntervalMinutes, target.crawlIntervalMaxMinutes),
          }),
          updatedAt: new Date(),
        })
        .where(eq(schema.crawlerTargets.id, target.id));
    } catch (targetError) {
      this.logger.error(
        `Error crawling gallery ${target.galleryId}`,
        targetError,
      );
    } finally {
      // 게시글로 저장되지 못한 후보(LLM/저장 실패, 중지, 수량 초과 등)의 업로드 이미지는 쓰레기 파일이 되므로 삭제
      await this.deleteUploadedImages(
        qualifiedCandidates
          .filter((c) => !c.saved)
          .flatMap((c) => c.uploadedImagePaths),
      );
    }

    if (signal.aborted) {
      this.logger.log(
        `Crawl for target "${target.name}" cancelled (Collected ${collected} before stop)`,
      );
    }

    return {
      collected,
      skipped,
      errors,
      cancelled: signal.aborted,
      skipDetails,
    };
  }

  /**
   * 중지 신호가 오면 즉시 깨어나는 대기
   */
  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }

  /**
   * '켠 이후 올라온 글만': 지금 디시 1페이지의 가장 큰 글 번호를 기준으로 적어 둔다 (디시 글 번호는 계속 커진다).
   * 디시 조회에 실패하면 null을 돌려주고, 다음 수집 때 다시 정한다
   */
  async captureNewPostsBaseline(targetId: string): Promise<number | null> {
    const target = await this.db.query.crawlerTargets.findFirst({
      where: eq(schema.crawlerTargets.id, targetId),
    });
    if (!target) return null;
    try {
      const items = await this.fetchGalleryPostList(target.galleryId, 0, 1);
      const ids = items.map((item) => Number(item.sourcePostId)).filter(Number.isFinite);
      if (ids.length === 0) {
        this.logger.warn(`Could not read latest post number for gallery ${target.galleryId}; will retry on next crawl.`);
        return null;
      }
      const baseline = Math.max(...ids);
      await this.db
        .update(schema.crawlerTargets)
        .set({ newPostsAfterId: baseline })
        .where(eq(schema.crawlerTargets.id, targetId));
      this.logger.log(`Target "${target.name}": collecting only posts after #${baseline}`);
      return baseline;
    } catch (error) {
      this.logger.warn(`Failed to capture latest post number for gallery ${target.galleryId}`, error);
      return null;
    }
  }

  /**
   * 모바일 디시 갤러리 목록 수집 (지정된 1개 모바일 페이지 엄격 1:1 매핑 탐색)
   */
  private async fetchGalleryPostList(
    galleryId: string,
    minRecommend: number,
    page: number = 1,
  ): Promise<ParsedPostItem[]> {
    const queryString = page > 1 ? `?page=${page}` : '';

    // 1차: 일반 및 마이너 갤러리 URL 시도
    let targetUrl = `https://m.dcinside.com/board/${galleryId}${queryString}`;
    let res = await fetch(targetUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: 'https://m.dcinside.com/',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    let html = await res.text();
    let isMini = false;

    // 2차: 404이거나 미존재 안내 페이지인 경우 미니 갤러리 URL로 자동 폴백 시도
    if (
      res.status === 404 ||
      html.includes('페이지를 찾을 수 없습니다') ||
      html.includes('penalty-box')
    ) {
      this.logger.log(
        `Board URL returned 404 or not found for ${galleryId}. Trying mini gallery path...`,
      );
      isMini = true;
      targetUrl = `https://m.dcinside.com/mini/${galleryId}${queryString}`;
      res = await fetch(targetUrl, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Referer: 'https://m.dcinside.com/',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!res.ok) {
        this.logger.warn(
          `Failed to fetch gallery list from ${targetUrl}, status: ${res.status}`,
        );
        return [];
      }
      html = await res.text();
    } else if (!res.ok) {
      this.logger.warn(
        `Failed to fetch gallery list from ${targetUrl}, status: ${res.status}`,
      );
      return [];
    }

    // PC 웹 목록에서 공지 및 고정글(icon_slow, icon_notice, 말머리 '고정', '공지' 등) ID 목록 추출
    const fixedPostIds = await this.fetchFixedAndNoticePostIds(
      galleryId,
      isMini,
    );

    const $ = cheerio.load(html);
    const results: ParsedPostItem[] = [];

    // 디시 모바일 게시판 항목 셀렉터
    const items = $('ul.gall-detail-lst > li, ul.gall-lst > li');

    items.each((_, el) => {
      const $el = $(el);
      // 공지사항 및 광고 제외
      if (
        $el.hasClass('list-notice') ||
        $el.hasClass('adv-box') ||
        $el.find('.notice').length > 0
      ) {
        return;
      }

      // /board/xxx/ 또는 /mini/xxx/ 링크 탐색
      const linkEl = $el.find(`a[href*="/${galleryId}/"]`);
      if (!linkEl.length) return;

      const href = linkEl.attr('href') || '';
      const match = href.match(
        new RegExp(`/(?:board|mini)/${galleryId}/(\\d+)`),
      );
      if (!match) return;

      const postId = match[1];

      // 고정글 및 공지글인 경우 수집 대상에서 제외
      if (fixedPostIds.has(postId)) {
        this.logger.log(
          `Skipping post ${postId}: Detected as fixed/notice post.`,
        );
        return;
      }

      const title =
        $el.find('.subjectin').text().trim() ||
        $el.find('.tit').text().trim() ||
        linkEl.text().trim();

      // 추천수 파싱 (.up-add span 우선 추출하여 부모-자식 텍스트 중복 방지)
      let recText = '';
      const recSpan = $el.find('.up-add span, .up-add em');
      if (recSpan.length) {
        recText = recSpan.first().text();
      } else {
        const upAdd = $el.find(
          '.up-add, .rec, .recommend, .num, li:contains("추천")',
        );
        if (upAdd.length) {
          recText = upAdd.first().text();
        }
      }
      const recommendCount = recText
        ? parseInt(recText.replace(/[^0-9]/g, ''), 10) || 0
        : 0;

      // 최소 추천수 조건을 만족하는지 명확히 검사
      const isQualified = recommendCount >= minRecommend;

      if (isQualified) {
        let fullUrl = href;
        if (!fullUrl.startsWith('http')) {
          fullUrl = `https://m.dcinside.com${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }

        results.push({
          sourcePostId: postId,
          title,
          recommendCount,
          url: fullUrl,
        });
      }
    });

    return results;
  }

  /**
   * PC 디시 웹페이지 목록을 조회하여 상단 '고정(icon_slow)' 및 '공지(icon_notice)' 글 번호 목록을 추출
   */
  private async fetchFixedAndNoticePostIds(
    galleryId: string,
    isMini: boolean,
  ): Promise<Set<string>> {
    const fixedIds = new Set<string>();
    try {
      const pcUrl = isMini
        ? `https://gall.dcinside.com/mini/board/lists/?id=${galleryId}`
        : `https://gall.dcinside.com/board/lists/?id=${galleryId}`;

      const res = await fetch(pcUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://gall.dcinside.com/',
        },
      });

      if (!res.ok) return fixedIds;

      const html = await res.text();
      const $ = cheerio.load(html);

      $('tr.ub-content').each((_, el) => {
        const dataType = $(el).attr('data-type') || '';
        const subject = $(el).find('.gall_subject').text().trim();
        const no =
          $(el).attr('data-no') || $(el).find('.gall_num').text().trim();

        if (
          dataType.includes('slow') ||
          dataType.includes('notice') ||
          subject.includes('고정') ||
          subject.includes('공지') ||
          subject.includes('설문') ||
          subject.includes('AD')
        ) {
          if (no && no !== '-') {
            fixedIds.add(no);
          }
        }
      });
    } catch (e) {
      this.logger.warn(
        `Failed to fetch PC fixed post IDs for ${galleryId}: ${e}`,
      );
    }
    return fixedIds;
  }

  /**
   * 모바일 디시 글 상세 페이지 파싱 (일반, 마이너, 미니 갤러리 공통 지원)
   */
  private async fetchPostDetail(
    galleryId: string,
    postId: string,
    postUrl: string,
    fallbackTitle?: string,
  ): Promise<PostDetail | null> {
    const isMini = postUrl.includes('/mini/');
    const referer = isMini
      ? `https://m.dcinside.com/mini/${galleryId}`
      : `https://m.dcinside.com/board/${galleryId}`;

    const res = await fetch(postUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: referer,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      this.logger.warn(
        `Failed to fetch post detail: ${postUrl}, status: ${res.status}`,
      );
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 제목 추출: og:title -> 본문 셀렉터 -> fallbackTitle
    let rawOgTitle = $('meta[property="og:title"]').attr('content') || '';
    if (rawOgTitle) {
      // "제목 - &광우상사 정보공유& 미니 갤러리" 또는 "제목 - 디시인사이드" 접미사 제거
      rawOgTitle = rawOgTitle
        .replace(/\s*-\s*.*갤러리.*$/, '')
        .replace(/\s*-\s*디시인사이드.*$/, '')
        .trim();
    }

    const title =
      rawOgTitle ||
      $('.gall-tit-box .tit').text().trim() ||
      $('.title_subject').text().trim() ||
      $('h3.title').text().trim() ||
      fallbackTitle ||
      '제목 없음';

    // 본문 컨테이너
    const contentBox = $(
      '.thum-txt, .writing_view_box, .gallview-contents',
    ).first();
    if (!contentBox.length) {
      this.logger.warn(`Could not find content container for post ${postId}`);
      return null;
    }

    // 불필요한 태그 제거 (스크립트, 인라인 광고, 워터마크 안내 등)
    contentBox
      .find('script, style, iframe, .adv-box, .app-download-box, .banner-box')
      .remove();

    // 이미지 추출 (움직이는 GIF의 경우 data-gif에 실제 원본이 있음)
    const imageUrls: string[] = [];
    contentBox.find('img').each((_, img) => {
      const src =
        $(img).attr('data-gif') ||
        $(img).attr('data-original') ||
        $(img).attr('data-src') ||
        $(img).attr('src');
      if (src && !src.includes('dc_sign') && !src.includes('emoticon/')) {
        imageUrls.push(src);
      }
    });

    const contentHtml = contentBox.html() || '';

    return {
      sourcePostId: postId,
      title,
      contentHtml,
      imageUrls,
      url: postUrl,
    };
  }

  /**
   * 디시인사이드 이미지 다운로드 및 자체 스토리지 업로드 후 src 치환
   */
  private async processImagesAndReplaceSrc(
    contentHtml: string,
  ): Promise<{ html: string; uploadedPaths: string[] }> {
    const $ = cheerio.load(contentHtml, null, false);
    const imgTags = $('img');
    const uploadedPaths: string[] = [];

    try {
      for (let i = 0; i < imgTags.length; i++) {
        const img = $(imgTags[i]);

        // 디시의 레이지 로딩 및 GIF 이미지 추출:
        // 디시는 움직이는 GIF의 경우 data-gif에 실제 원본 주소를 두고,
        // src나 data-original에는 투명 플레이스홀더를 두므로 data-gif를 최우선으로 가져옵니다!
        let originalSrc =
          img.attr('data-gif') ||
          img.attr('data-original') ||
          img.attr('data-src') ||
          img.attr('src') ||
          '';

        // 상대경로 및 프로토콜 누락 정규화
        if (originalSrc.startsWith('//')) {
          originalSrc = 'https:' + originalSrc;
        } else if (originalSrc.startsWith('/')) {
          originalSrc = 'https://m.dcinside.com' + originalSrc;
        }

        // 디시 UI용 로딩 GIF, 닫기 버튼, 서명콘 등 더미 이미지는 제거
        if (
          !originalSrc ||
          originalSrc.includes('loading_ori.gif') ||
          originalSrc.includes('dccon_loading') ||
          originalSrc.includes('btn_close') ||
          originalSrc.includes('dc_sign') ||
          originalSrc.startsWith('data:') ||
          originalSrc.includes('base64')
        ) {
          // 실제 data-gif/data-original이 없는 더미 이미지 태그는 DOM에서 제거
          originalSrc =
            img.attr('data-gif') ||
            img.attr('data-original') ||
            img.attr('data-src') ||
            '';
          if (originalSrc.startsWith('//')) {
            originalSrc = 'https:' + originalSrc;
          } else if (originalSrc.startsWith('/')) {
            originalSrc = 'https://m.dcinside.com' + originalSrc;
          }
          if (!originalSrc || originalSrc.includes('loading_ori.gif')) {
            img.remove();
            continue;
          }
        }

        try {
          // Referer 헤더를 설정하여 403 차단 우회
          const imageRes = await fetch(originalSrc, {
            headers: {
              'User-Agent': DEFAULT_USER_AGENT,
              Referer: 'https://m.dcinside.com/',
            },
          });

          if (!imageRes.ok) {
            this.logger.warn(
              `Failed to download image: ${originalSrc}, status: ${imageRes.status}`,
            );
            img.remove(); // 실패한 이미지는 로딩 gif가 남지 않도록 제거
            continue;
          }

          // 업로드가 받지 않는 크기(원본 최대)면 내려받지 않고 건너뛴다 (최적화 후 저장 크기는 업로드에서 검사)
          const contentLength = Number(imageRes.headers.get('content-length') || 0);
          if (contentLength > UPLOAD_LIMITS.IMAGE_INPUT_SIZE) {
            this.logger.warn(
              `Image too large to import: ${originalSrc} (${(contentLength / 1024 / 1024).toFixed(1)}MB)`,
            );
            await imageRes.body?.cancel();
            img.remove();
            continue;
          }

          const arrayBuffer = await imageRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // 디시 서버는 Content-Type을 application/octet-stream으로 반환하므로 Sharp로 실제 포맷 감지
          let contentType = imageRes.headers.get('content-type') || '';
          if (
            !contentType.startsWith('image/') ||
            contentType === 'application/octet-stream'
          ) {
            try {
              const meta = await sharp(buffer, { animated: true }).metadata();
              contentType = meta.format
                ? `image/${meta.format === 'jpg' ? 'jpeg' : meta.format}`
                : 'image/jpeg';
            } catch {
              contentType = 'image/jpeg';
            }
          }

          // 자체 스토리지 업로드 (WebP 변환 및 최적화 자동 수행 - GIF는 움직이는 애니메이션 WebP로 변환)
          const uploadResult = await this.uploadsService.uploadImage(
            buffer,
            contentType,
            'crawled',
            undefined,
            { responsive: true },
          );
          uploadedPaths.push(uploadResult.path, ...uploadResult.variantPaths);

          img.attr('src', uploadResult.url);
          // 저장된 이미지 크기를 넣어 두면 이미지가 도착하기 전에 자리가 잡혀 아래 글이 밀리지 않는다 (CSS height:auto로 비율만 사용)
          if (uploadResult.width && uploadResult.height) {
            img.attr('width', String(uploadResult.width));
            img.attr('height', String(uploadResult.height));
          } else {
            img.removeAttr('width');
            img.removeAttr('height');
          }
          // 작은 버전이 있으면 화면 크기에 맞는 이미지를 받도록 srcset을 넣는다 (원본 사이트의 srcset은 버림)
          if (uploadResult.srcset) {
            img.attr('srcset', uploadResult.srcset);
          } else {
            img.removeAttr('srcset');
          }
          img.removeAttr('data-gif');
          img.removeAttr('data-mp4');
          img.removeAttr('data-original');
          img.removeAttr('data-src');
          img.removeAttr('onclick');
          img.removeAttr('data-fileno');
          img.removeAttr('zoom-number');
          img.removeClass('lazy gif-mp4');
          img.addClass('crawled-image rounded-lg my-2 max-w-full h-auto');
        } catch (imgError) {
          this.logger.warn(
            `Image processing failed for: ${originalSrc}`,
            imgError,
          );
          img.remove(); // 처리 실패 시 깨진 이미지/로딩 gif 제거
        }
      }
    } catch (err) {
      // 처리 도중 예상치 못한 오류로 중단되면 이미 올린 이미지는 쓸 곳이 없으므로 삭제
      await this.deleteUploadedImages(uploadedPaths);
      throw err;
    }

    return { html: $.html(), uploadedPaths };
  }

  private async deleteUploadedImages(paths: string[]): Promise<void> {
    for (const imgPath of paths) {
      try {
        await this.uploadsService.deleteImage(imgPath);
      } catch (err) {
        this.logger.warn(
          `Failed to delete unused crawled image: ${imgPath}`,
          err,
        );
      }
    }
    if (paths.length > 0) {
      this.logger.log(`Deleted ${paths.length} unused crawled image(s)`);
    }
  }

  /**
   * 닉네임 배합 생성 (메인 + 보조 키워드 또는 기본 봇 닉네임)
   */
  private generateAuthorNickname(
    target: typeof schema.crawlerTargets.$inferSelect,
  ): string {
    const mainList = (target.authorMainKeywords || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const subList = (target.authorSubKeywords || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (mainList.length > 0) {
      const selectedMain =
        mainList[Math.floor(Math.random() * mainList.length)];
      if (target.authorUseSub && subList.length > 0) {
        const selectedSub = subList[Math.floor(Math.random() * subList.length)];
        return `${selectedMain}${selectedSub}`;
      }
      return selectedMain;
    }

    return BOT_NICKNAMES[Math.floor(Math.random() * BOT_NICKNAMES.length)];
  }

  /**
   * 댓글 작성자 닉네임 배합 생성 (메인 + 보조 키워드 또는 LLM 생성 닉네임/기본 봇 닉네임)
   */
  private generateCommentAuthorNickname(
    target: typeof schema.crawlerTargets.$inferSelect,
    fallbackNickname?: string,
  ): string {
    const mainList = (target.commentAuthorMainKeywords || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const subList = (target.commentAuthorSubKeywords || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (mainList.length > 0) {
      const selectedMain =
        mainList[Math.floor(Math.random() * mainList.length)];
      if (target.commentAuthorUseSub && subList.length > 0) {
        const selectedSub = subList[Math.floor(Math.random() * subList.length)];
        return `${selectedMain}${selectedSub}`;
      }
      return selectedMain;
    }

    return (
      fallbackNickname ||
      BOT_NICKNAMES[Math.floor(Math.random() * BOT_NICKNAMES.length)]
    );
  }

  /**
   * 수집 이력 단건 및 연관된 게시글, 댓글, 호스팅 이미지 영구 삭제
   */
  async deleteCrawlerLog(
    logId: string,
  ): Promise<{ success: boolean; deletedImagesCount: number }> {
    const results = await this.deleteCrawlerLogs([logId]);
    return { success: true, deletedImagesCount: results.deletedImagesCount };
  }

  /**
   * 수집 이력 다건 및 연관된 게시글, 댓글, 호스팅 이미지 일괄 영구 삭제
   */
  async deleteCrawlerLogs(logIds: string[]): Promise<{
    success: boolean;
    deletedLogsCount: number;
    deletedPostsCount: number;
    deletedImagesCount: number;
  }> {
    if (!logIds || logIds.length === 0) {
      return {
        success: true,
        deletedLogsCount: 0,
        deletedPostsCount: 0,
        deletedImagesCount: 0,
      };
    }

    const logs = await this.db.query.crawlerLogs.findMany({
      where: inArray(schema.crawlerLogs.id, logIds),
    });

    const postIds = logs
      .map((l) => l.createdPostId)
      .filter((id): id is string => Boolean(id));

    let deletedImagesCount = 0;

    if (postIds.length > 0) {
      // 1. 해당 게시글들 조회
      const targetPosts = await this.db.query.posts.findMany({
        where: inArray(schema.posts.id, postIds),
      });

      // 2. 해당 게시글들에 달린 댓글 조회
      const targetComments = await this.db.query.comments.findMany({
        where: and(
          inArray(schema.comments.targetId, postIds),
          eq(schema.comments.targetType, 'post'),
        ),
      });

      // 3. 이미지 경로 수집 (고아 이미지 방지)
      const imagePathsToDelete = new Set<string>();

      const collectImagePaths = (htmlOrUrl?: string | null) => {
        if (!htmlOrUrl) return;
        // HTML 내 img 태그 src 속성 추출
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        let match: RegExpExecArray | null;
        while ((match = imgRegex.exec(htmlOrUrl)) !== null) {
          const src = match[1];
          const path =
            this.uploadsService.extractPathFromUrl(src) ||
            this.extractRelativePath(src);
          if (path) imagePathsToDelete.add(path);
        }
        // 작은 버전(srcset의 "주소 너비w" 목록)도 함께 지운다
        const srcsetRegex = /<img[^>]+srcset=["']([^"']+)["']/gi;
        while ((match = srcsetRegex.exec(htmlOrUrl)) !== null) {
          for (const candidate of match[1].split(',')) {
            const src = candidate.trim().split(/\s+/)[0];
            const path = src && (this.uploadsService.extractPathFromUrl(src) || this.extractRelativePath(src));
            if (path) imagePathsToDelete.add(path);
          }
        }

        // 단일 이미지 URL일 수도 있는 경우
        if (htmlOrUrl.startsWith('http') || htmlOrUrl.includes('crawled/')) {
          const path =
            this.uploadsService.extractPathFromUrl(htmlOrUrl) ||
            this.extractRelativePath(htmlOrUrl);
          if (path) imagePathsToDelete.add(path);
        }
      };

      for (const p of targetPosts) {
        collectImagePaths(p.content);
      }

      for (const c of targetComments) {
        collectImagePaths(c.content);
        collectImagePaths(c.imageUrl);
      }

      // 4. 스토리지에서 호스팅 이미지 삭제
      for (const imgPath of imagePathsToDelete) {
        try {
          await this.uploadsService.deleteImage(imgPath);
          deletedImagesCount++;
          this.logger.log(`Deleted crawled image from storage: ${imgPath}`);
        } catch (err) {
          this.logger.warn(`Failed to delete storage image: ${imgPath}`, err);
        }
      }

      // 5. 댓글 삭제
      await this.db
        .delete(schema.comments)
        .where(
          and(
            inArray(schema.comments.targetId, postIds),
            eq(schema.comments.targetType, 'post'),
          ),
        );

      // 6. 게시글 삭제 (postReactions, scraps 등은 DB onDelete: cascade로 자동 정리)
      await this.db
        .delete(schema.posts)
        .where(inArray(schema.posts.id, postIds));
    }

    // 7. crawler_logs 레코드 삭제
    await this.db
      .delete(schema.crawlerLogs)
      .where(inArray(schema.crawlerLogs.id, logIds));

    this.logger.log(
      `Deleted ${logs.length} crawler logs, ${postIds.length} posts, and ${deletedImagesCount} storage images`,
    );

    return {
      success: true,
      deletedLogsCount: logs.length,
      deletedPostsCount: postIds.length,
      deletedImagesCount,
    };
  }

  private extractRelativePath(url: string): string | null {
    const match = url.match(/(crawled\/[^\s"'?#]+)/);
    return match ? match[1] : null;
  }
}
