import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateBoardRequestDto, ErrorCode, ReviewBoardRequestDto } from '@community/shared-types';
import { ApiException } from '../../common/exceptions/api.exception';
import { BoardsRepository } from './boards.repository';
import { BoardsService } from './boards.service';
import { BoardRequestReviewedEvent } from './events/board-request-reviewed.event';

/** 한 사람이 동시에 대기시킬 수 있는 개설 신청 수 */
const MAX_PENDING_REQUESTS_PER_USER = 1;
/** 신청으로 만든 게시판은 관리자가 만든 게시판 뒤에 놓는다 */
const USER_BOARD_SORT_ORDER = 1000;

/**
 * 게시판 개설 신청. 회원 누구나 신청하고, 사이트 관리자가 승인하면 게시판(type='user')이 생기며 신청자가 매니저가 된다
 */
@Injectable()
export class BoardRequestsService {
  constructor(
    private readonly boardsRepo: BoardsRepository,
    private readonly boardsService: BoardsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(requesterId: string, dto: CreateBoardRequestDto) {
    if ((await this.boardsRepo.countPendingRequests(requesterId)) >= MAX_PENDING_REQUESTS_PER_USER) {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, '처리 대기 중인 신청이 있습니다. 결과가 나온 뒤 다시 신청해주세요.');
    }
    await this.assertSlugAvailable(dto.slug);
    return this.boardsRepo.insertRequest({
      requesterId,
      slug: dto.slug,
      name: dto.name.trim(),
      description: dto.description?.trim() || undefined,
      reason: dto.reason?.trim() || undefined,
    });
  }

  findMine(requesterId: string) {
    return this.boardsRepo.findRequestsByRequester(requesterId);
  }

  async findAll(status: string | undefined, page: number, limit: number) {
    page = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    limit = Number.isFinite(limit) && limit >= 1 ? Math.min(Math.floor(limit), 100) : 20;
    return this.boardsRepo.findRequests(status, (page - 1) * limit, limit);
  }

  /** 승인: 게시판을 만들고 신청자를 매니저로. 반려: 사유를 남긴다. 결과는 신청자에게 알림 */
  async review(id: string, reviewerId: string, dto: ReviewBoardRequestDto) {
    const request = await this.boardsRepo.findRequestById(id);
    if (!request) throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.NOT_FOUND, '신청을 찾을 수 없습니다.');
    if (request.status !== 'pending') {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, '이미 처리된 신청입니다.');
    }

    let boardSlug: string | undefined;
    const reviewed = await this.boardsRepo.transaction(async (tx) => {
      if (dto.status === 'rejected') {
        return this.boardsRepo.markRequestReviewed(id, { status: 'rejected', rejectReason: dto.rejectReason?.trim() || null, reviewedById: reviewerId }, tx);
      }
      // 신청 후 같은 주소의 게시판이 생겼을 수 있어 승인 시점에 다시 확인
      if (await this.boardsRepo.findBySlug(request.slug, tx)) {
        throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, '같은 주소의 게시판이 이미 있습니다. 반려 후 다른 주소로 다시 신청하도록 안내해주세요.');
      }
      const [board] = await this.boardsRepo.insertBoard({
        slug: request.slug,
        name: request.name,
        description: request.description,
        type: 'user',
        sortOrder: USER_BOARD_SORT_ORDER,
      }, tx);
      await this.boardsRepo.insertManager({ boardId: board.id, userId: request.requesterId, role: 'manager' }, tx);
      boardSlug = board.slug;
      return this.boardsRepo.markRequestReviewed(id, { status: 'approved', reviewedById: reviewerId, boardId: board.id }, tx);
    });
    // 두 관리자가 동시에 처리하면 한쪽은 바뀐 행이 없다 (트랜잭션이라 게시판도 만들어지지 않음)
    if (!reviewed) throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, '이미 처리된 신청입니다.');

    if (dto.status === 'approved') this.boardsService.invalidateCache();
    this.eventEmitter.emit(
      'board.request.reviewed',
      new BoardRequestReviewedEvent(request.requesterId, reviewerId, id, request.name, dto.status, boardSlug, reviewed.rejectReason),
    );
    return reviewed;
  }

  private async assertSlugAvailable(slug: string) {
    if ((await this.boardsRepo.findBySlug(slug)) || (await this.boardsRepo.isSlugRequested(slug))) {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.CONFLICT, '이미 쓰이고 있거나 신청 중인 주소입니다.');
    }
  }
}
