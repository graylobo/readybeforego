import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { ErrorCode } from '@community/shared-types';
import { ApiException } from '../../common/exceptions/api.exception';
import { boards } from '../../database/schema';
import { BoardsRepository } from './boards.repository';

type BoardRow = typeof boards.$inferSelect;
interface BoardCache {
  expiresAt: number;
  bySlug: Map<string, BoardRow>;
  active: BoardRow[];
}

// 게시판 정보는 거의 바뀌지 않으므로 서버 메모리에 잠깐 들고 있어,
// 게시글 목록/작성 요청마다 게시판을 DB에서 다시 읽지 않는다.
// 관리자가 수정하면 해당 서버는 즉시 비우고, 서버가 여러 대면(배포 중 포함) 다른 서버는 최대 이 시간 뒤 반영된다.
// 게시판 목록 조회는 가벼워 짧게 둔다 (예전 30초 + 응답 캐시 60초가 겹쳐 사이드바에 1분 넘게 옛 목록이 보였다)
const BOARD_CACHE_TTL_MS = 5_000;

@Injectable()
export class BoardsService implements OnModuleInit {
  private boardCache: BoardCache | null = null;
  private boardCacheLoading: Promise<BoardCache> | null = null;

  constructor(
    private readonly boardsRepo: BoardsRepository,
  ) {}

  private async getBoardCache(): Promise<BoardCache> {
      if (this.boardCache && this.boardCache.expiresAt > Date.now()) return this.boardCache;
      // 동시에 여러 요청이 와도 DB 조회는 한 번만
      if (!this.boardCacheLoading) {
          this.boardCacheLoading = this.boardsRepo
              .findAll()
              .then((all: BoardRow[]) => {
                  const cache: BoardCache = {
                      expiresAt: Date.now() + BOARD_CACHE_TTL_MS,
                      bySlug: new Map(all.map((b) => [b.slug, b])),
                      active: all.filter((b) => b.isActive),
                  };
                  this.boardCache = cache;
                  return cache;
              })
              .finally(() => {
                  this.boardCacheLoading = null;
              });
      }
      return this.boardCacheLoading;
  }

  private invalidateBoardCache() {
      this.boardCache = null;
  }

  /** 다른 서비스(개설 신청 승인, 게시판 삭제 등)에서 게시판이 바뀌었을 때 */
  invalidateCache() {
      this.invalidateBoardCache();
  }

  async onModuleInit() {
      const defaultBoards = [
          { slug: 'news', name: '공지사항', description: '커뮤니티 소식', sortOrder: 0 },
          { slug: 'free', name: '자유게시판', description: '자유롭게 이야기하는 공간', sortOrder: 1 },
          { slug: 'qna', name: '질문답변', description: '무엇이든 물어보세요', sortOrder: 2 },
          { slug: 'inquiry', name: '1:1 문의/신고', description: '운영자와의 1:1 대화', sortOrder: 3, isPrivate: true },
      ];

      for (const board of defaultBoards) {
          const exists = await this.boardsRepo.findBySlug(board.slug);
          if (!exists) {
              await this.boardsRepo.insertBoard(board);
              console.log(`Seeded board: ${board.slug}`);
          }
      }
      this.invalidateBoardCache();
  }

  async findAll() {
      return (await this.getBoardCache()).active;
  }

  async findBySlug(slug: string) {
      // 전체 게시판: 공개 게시판의 글을 모아 보여주기만 하는 화면 (실제 게시판이 아니라 글을 쓸 수 없음)
      if (slug === 'all') {
          return {
              id: 'virtual-all-board',
              slug: 'all',
              name: '전체 게시판',
              description: '모든 게시판의 최신 글',
              sortOrder: -2,
              isPrivate: false,
              allowAnonymous: false,
              isActive: true,
              isReadOnly: true,
              type: 'system' as const,
              viewMode: 'list',
          };
      }
      if (slug === 'best') {
          return {
              id: 'virtual-best-board',
              slug: 'best',
              name: '베스트 게시판',
              description: '가장 핫한 게시물 모음이요',
              sortOrder: -1,
              isPrivate: false,
              allowAnonymous: false,
              isActive: true,
              isReadOnly: true,
              type: 'system' as const,
              viewMode: 'list',
          };
      }
      return (await this.getBoardCache()).bySlug.get(slug);
  }
  /** 게시판 목록 페이지: 공개 게시판, 글 수, 매니저 (이름 검색) */
  async findDirectory(query?: string) {
      return this.boardsRepo.findDirectory(query);
  }

  async findAllAdmin() {
      // Return all boards, sorted by sortOrder
      return this.boardsRepo.findAll();
  }

  async findById(id: string) {
      return this.boardsRepo.findById(id);
  }

  async create(dto: any) {
      if (await this.boardsRepo.findBySlug(dto.slug)) {
          throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, '이미 있는 게시판 주소입니다.');
      }
      const result = await this.boardsRepo.insertBoard({
          slug: dto.slug,
          name: dto.name,
          description: dto.description,
          sortOrder: dto.sortOrder,
          allowAnonymous: dto.allowAnonymous,
          isPrivate: dto.isPrivate || false,
          viewMode: dto.viewMode || 'list',
          type: 'system', // Default to system for now
      });
      this.invalidateBoardCache();
      return result[0];
  }

  async update(id: string, dto: any) {
      const result = await this.boardsRepo.updateBoard(id, dto);
      this.invalidateBoardCache();
      return result[0];
  }

  /** 다른 서비스의 트랜잭션 안에서 게시판 행을 지운다 (글까지 함께 지우는 삭제에서 사용) */
  async deleteInTransaction(id: string, tx: any) {
      await this.boardsRepo.deleteBoard(id, tx);
  }

  async delete(id: string) {
      // 게시글이 있는 게시판을 지우면 글이 모두 함께 사라지고, 글의 이미지는 저장소에 남는다.
      // 실수로 지우지 않도록 글을 먼저 지우거나 옮긴 뒤에만 삭제할 수 있게 한다
      const postCount = await this.boardsRepo.countLivePosts(id);
      if (postCount > 0) {
          throw new ApiException(
              ErrorCode.INVALID_INPUT,
              HttpStatus.CONFLICT,
              `게시글이 ${postCount}개 있는 게시판은 삭제할 수 없습니다. 게시글을 먼저 삭제해주세요.`,
          );
      }
      await this.boardsRepo.deleteBoard(id);
      this.invalidateBoardCache();
      return true;
  }
}
