import { Body, Controller, Delete, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CreateCommentZodDto, TogglePostReactionZodDto, UpdateCommentZodDto } from '../../common/dto/zod-dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CommentsService, CommentViewer } from './comments.service';
import { getClientIp } from '../../common/utils/client-ip';
import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '@community/shared-types';

// 요청한 사용자 (역할은 인증 단계에서 읽은 값을 그대로 사용)
function toViewer(req: any): CommentViewer {
  return { userId: req.user?.id, role: req.user?.role, ipAddress: getClientIp(req) };
}

// 게시글·제보 댓글의 대상 id는 UUID다. 국가 가이드(country_guide)는 국가 코드라 길이만 확인한다
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertTargetId(targetType: string, targetId: string | undefined) {
  const valid = targetType === 'country_guide' ? !!targetId && targetId.length <= 16 : UUID_PATTERN.test(targetId ?? '');
  if (!valid) throw new ApiException(ErrorCode.POST_NOT_FOUND, HttpStatus.NOT_FOUND);
}

@ApiTags('comments')
@Controller('comments')
@UseGuards(JwtAuthGuard)
@Public()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: '댓글 작성' })
  @ApiBody({ type: CreateCommentZodDto })
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(CreateCommentZodDto))
  create(
      @Body() createCommentDto: CreateCommentZodDto,
      @Req() req: any
  ) {
    assertTargetId(createCommentDto.targetType, createCommentDto.targetId);
    return this.commentsService.create(toViewer(req), createCommentDto, req.headers['user-agent']);
  }

  @Get()
  findAll(
      @Query('targetType') targetType: string,
      // 국가 가이드 댓글의 대상 id는 국가 코드라 형식 검사는 assertTargetId에서 대상별로 한다
      @Query('targetId') targetId: string,
      @Query('page') page: string = '1',
      @Query('limit') limit: string = '100',
      @Req() req: any
  ) {
    assertTargetId(targetType, targetId);
    return this.commentsService.getCommentsByTarget(
      targetType,
      targetId,
      toViewer(req),
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get('user/:userId')
  findByUser(
    @Param('userId', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    return this.commentsService.findByUser(userId, parseInt(page), parseInt(limit));
  }

  @Patch(':id')
  // 비회원 비밀번호를 무작위로 대입해 보는 것을 막기 위해 횟수를 제한한다 (verify-password만 막으면 이쪽으로 우회 가능)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: '댓글 수정' })
  @ApiBody({ type: UpdateCommentZodDto })
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(UpdateCommentZodDto))
  update(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string, 
      @Body() updateCommentDto: UpdateCommentZodDto,
      @Req() req: any
  ) {
      return this.commentsService.update(id, toViewer(req), updateCommentDto, req.headers['user-agent']);
  }

  @Delete(':id')
  // 비회원 비밀번호를 무작위로 대입해 보는 것을 막기 위해 횟수를 제한한다 (verify-password만 막으면 이쪽으로 우회 가능)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(UserStatusGuard)
  remove(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string, 
      @Body() body: { guestPassword?: string; deleteMode?: 'soft' | 'hard' },
      @Query('deleteMode') queryDeleteMode: 'soft' | 'hard',
      @Req() req: any
  ) {
      const deleteMode = body?.deleteMode || queryDeleteMode || 'soft';
      return this.commentsService.remove(id, toViewer(req), body?.guestPassword, deleteMode, req.headers['user-agent']);
  }

  @Post(':id/reaction')
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(TogglePostReactionZodDto))
  toggleReaction(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Body() body: TogglePostReactionZodDto,
      @Req() req: any
  ) {
      return this.commentsService.toggleReaction(id, toViewer(req), body.type, req.headers['user-agent']);
  }
}
