import { HttpStatus, Injectable } from '@nestjs/common';
import { BOARD_SUB_MANAGER_LIMIT, BoardManager, ErrorCode, isAdmin } from '@community/shared-types';
import { ApiException } from '../../common/exceptions/api.exception';
import { BoardsRepository } from './boards.repository';
import { BoardsService } from './boards.service';

/** 요청한 사용자 (역할은 인증 단계에서 읽은 값) */
export interface BoardViewer {
  userId?: string;
  role?: string;
}

/**
 * 게시판 관리자(매니저 1명 + 부매니저 최대 3명).
 * 매니저·부매니저는 자기 게시판에서만 글/댓글 삭제, 공지·고정을 할 수 있고, 사이트 관리자는 모든 게시판에서 할 수 있다.
 */
@Injectable()
export class BoardManagersService {
  constructor(
    private readonly boardsRepo: BoardsRepository,
    private readonly boardsService: BoardsService,
  ) {}

  /** 이 게시판의 글/댓글을 관리(삭제·공지)할 수 있는지: 사이트 관리자 또는 이 게시판의 매니저·부매니저 */
  async canModerate(boardId: string, viewer: BoardViewer): Promise<boolean> {
    if (!viewer.userId) return false;
    if (isAdmin(viewer.role as any)) return true;
    return !!(await this.boardsRepo.findManagerRole(boardId, viewer.userId));
  }

  /**
   * 게시판 관리자 목록. 매니저가 '관리자 표시'를 끈 게시판은 일반 방문자에게 빈 목록을 준다
   * (매니저·부매니저 본인과 사이트 관리자는 관리 권한 확인을 위해 계속 받는다)
   */
  async getManagers(slug: string, viewer: BoardViewer = {}): Promise<BoardManager[]> {
    const board = await this.requireBoard(slug);
    const managers = await this.boardsRepo.findManagers(board.id);
    if (board.showManagers || isAdmin(viewer.role as any)) return managers;
    return managers.some((m) => m.userId === viewer.userId) ? managers : [];
  }

  /** 부매니저 지정: 매니저 또는 사이트 관리자, 최대 BOARD_SUB_MANAGER_LIMIT명 */
  async addSubManager(slug: string, viewer: BoardViewer, name: string) {
    const board = await this.requireBoard(slug);
    await this.assertManager(board.id, viewer);

    const target = await this.boardsRepo.findUserByName(name.trim());
    if (!target) throw new ApiException(ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND, '해당 닉네임의 회원을 찾을 수 없습니다.');

    const managers = await this.boardsRepo.findManagers(board.id);
    if (managers.some((m) => m.userId === target.id)) {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, '이미 이 게시판의 관리자입니다.');
    }
    if (managers.filter((m) => m.role === 'sub_manager').length >= BOARD_SUB_MANAGER_LIMIT) {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, `부매니저는 최대 ${BOARD_SUB_MANAGER_LIMIT}명까지 둘 수 있습니다.`);
    }
    // 동시에 두 번 지정해도 고유 조건(게시판+회원)으로 한 번만 들어간다
    await this.boardsRepo.insertManager({ boardId: board.id, userId: target.id, role: 'sub_manager' }).catch(() => {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, '이미 이 게시판의 관리자입니다.');
    });
    return this.boardsRepo.findManagers(board.id);
  }

  /** 부매니저 해제: 매니저 또는 사이트 관리자 (부매니저 본인도 스스로 물러날 수 있음) */
  async removeSubManager(slug: string, viewer: BoardViewer, userId: string) {
    const board = await this.requireBoard(slug);
    const role = await this.boardsRepo.findManagerRole(board.id, userId);
    if (role !== 'sub_manager') throw new ApiException(ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND, '부매니저가 아닙니다.');
    if (viewer.userId !== userId) await this.assertManager(board.id, viewer);
    await this.boardsRepo.deleteManager(board.id, userId);
    return this.boardsRepo.findManagers(board.id);
  }

  /**
   * 매니저 변경 (사이트 관리자만). 예: 실제 크루 관리자가 요청하면 다른 회원으로 바꿔 준다.
   * 새 매니저가 부매니저였다면 매니저로 올리고, 이전 매니저는 관리자에서 빠진다
   */
  async changeManager(boardId: string, name: string) {
    const board = await this.boardsRepo.findById(boardId);
    if (!board) throw new ApiException(ErrorCode.BOARD_NOT_FOUND, HttpStatus.NOT_FOUND);
    const target = await this.boardsRepo.findUserByName(name.trim());
    if (!target) throw new ApiException(ErrorCode.USER_NOT_FOUND, HttpStatus.NOT_FOUND, '해당 닉네임의 회원을 찾을 수 없습니다.');

    await this.boardsRepo.transaction(async (tx) => {
      await this.boardsRepo.deleteManagersByRole(board.id, 'manager', tx);
      await this.boardsRepo.deleteManager(board.id, target.id, tx);
      await this.boardsRepo.insertManager({ boardId: board.id, userId: target.id, role: 'manager' }, tx);
    });
    return this.boardsRepo.findManagers(board.id);
  }

  /** 매니저가 고칠 수 있는 게시판 설정: 설명, 관리자 표시 여부 (보낸 항목만) */
  async updateSettings(slug: string, viewer: BoardViewer, settings: { description?: string; showManagers?: boolean }) {
    const board = await this.requireBoard(slug);
    await this.assertManager(board.id, viewer);
    const updates: { description?: string; showManagers?: boolean } = {};
    if (settings.description !== undefined) updates.description = settings.description.trim();
    if (settings.showManagers !== undefined) updates.showManagers = settings.showManagers;
    return this.boardsService.update(board.id, updates);
  }

  private async requireBoard(slug: string) {
    const board = await this.boardsRepo.findBySlug(slug);
    if (!board) throw new ApiException(ErrorCode.BOARD_NOT_FOUND, HttpStatus.NOT_FOUND);
    return board;
  }

  /** 매니저(부매니저 제외) 또는 사이트 관리자 */
  private async assertManager(boardId: string, viewer: BoardViewer) {
    if (!viewer.userId) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
    if (isAdmin(viewer.role as any)) return;
    if ((await this.boardsRepo.findManagerRole(boardId, viewer.userId)) !== 'manager') {
      throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, '게시판 매니저만 할 수 있습니다.');
    }
  }
}
