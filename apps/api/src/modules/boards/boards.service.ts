import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { BoardsRepository } from './boards.repository';

@Injectable()
export class BoardsService implements OnModuleInit {
  constructor(
    private readonly boardsRepo: BoardsRepository,
  ) {}

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
  }

  async findAll() {
      return this.boardsRepo.findAllActive();
  }

  async findBySlug(slug: string) {
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
          };
      }
      return this.boardsRepo.findBySlug(slug);
  }
  async findAllAdmin() {
      // Return all boards, sorted by sortOrder
      return this.boardsRepo.findAll();
  }

  async findById(id: string) {
      return this.boardsRepo.findById(id);
  }

  async create(dto: any) {
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
      return result[0];
  }

  async update(id: string, dto: any) {
      const result = await this.boardsRepo.updateBoard(id, dto);
      return result[0];
  }

  async delete(id: string) {
      await this.boardsRepo.deleteBoard(id);
      return true;
  }
}
