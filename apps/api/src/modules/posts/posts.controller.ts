import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, Delete, Put, UsePipes, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PostsService, Viewer } from './posts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreatePostZodDto, UpdatePostZodDto, TogglePostReactionZodDto } from '../../common/dto/zod-dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '@community/shared-types';
import { getClientIp } from '../../common/utils/client-ip';

// 요청한 사용자 (역할은 인증 단계에서 읽은 값을 그대로 사용해 DB를 다시 조회하지 않음)
function toViewer(req: any): Viewer {
  return { userId: req.user?.id, role: req.user?.role, ipAddress: getClientIp(req) };
}

@ApiTags('posts')
@Controller('posts')
@UseGuards(JwtAuthGuard)
@Public()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async getPosts(
    @Req() req: any,
    @Query('board') boardSlug?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('searchType') searchType?: string,
    @Query('searchQuery') searchQuery?: string,
    @Query('authorId') authorId?: string,
    @Query('isBest') isBest?: string,
    @Query('isNotice') isNotice?: string,
    @Query('includeContent') includeContent?: string,
  ) {
      return this.postsService.findAll(
        {
          boardSlug,
          page: parseInt(page),
          limit: parseInt(limit),
          searchType,
          searchQuery,
          authorId,
          isBest: isBest === 'true',
          isNotice: isNotice === 'true' ? true : isNotice === 'false' ? false : undefined,
          includeContent: includeContent === 'true',
        },
        toViewer(req),
      );
  }

  @Get('board-page/:slug')
  @ApiOperation({ summary: '게시판 화면 데이터 (게시판 정보 + 공지/인기글 + 게시글 목록을 한 번에)' })
  async getBoardPage(
    @Req() req: any,
    @Param('slug') slug: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '30',
    @Query('searchType') searchType?: string,
    @Query('searchQuery') searchQuery?: string,
  ) {
      return this.postsService.getBoardPage(
        slug,
        { page: parseInt(page), limit: parseInt(limit), searchType, searchQuery },
        toViewer(req),
      );
  }

  @Get('sitemap/summary')
  @ApiOperation({ summary: '사이트맵: 넣을 글 수와 조각 크기' })
  async getSitemapSummary() {
      return this.postsService.getSitemapSummary();
  }

  @Get('sitemap/chunk/:chunk')
  @ApiOperation({ summary: '사이트맵 n번째 조각의 글 (사람이 쓴 공개 글, 오래된 순)' })
  async getSitemapChunk(@Param('chunk') chunk: string) {
      return this.postsService.getSitemapChunk(parseInt(chunk, 10));
  }

  @Get('my/scrapped')
  async getMyScrapped(
      @Req() req: any,
      @Query('page') page: string = '1',
      @Query('limit') limit: string = '20',
  ) {
      if (!req.user) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
      return this.postsService.findScrappedPosts(
        { userId: req.user.id, role: req.user.role },
        parseInt(page),
        parseInt(limit),
      );
  }

  @Get(':id')
  async getPost(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
    @Req() req: any,
  ) {
      return this.postsService.findOne(id, toViewer(req));
  }

  @Post(':id/view')
  @ApiOperation({ summary: '게시물 조회수 기록' })
  async recordView(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
  ) {
      return this.postsService.recordView(id);
  }

  @Post(':id/scrap')
  async toggleScrap(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Req() req: any
  ) {
      if (!req.user) throw new ApiException(ErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED);
      return this.postsService.toggleScrap(id, { userId: req.user.id, role: req.user.role });
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: '게시물 작성' })
  @ApiBody({ type: CreatePostZodDto })
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(CreatePostZodDto))
  async createPost(
      @Req() req: any,
      @Body() body: CreatePostZodDto
  ) {
      return this.postsService.create(toViewer(req), body.boardSlug, body, req.headers['user-agent']);
  }

  @Put(':id')
  // 비회원 비밀번호를 무작위로 대입해 보는 것을 막기 위해 횟수를 제한한다 (verify-password만 막으면 이쪽으로 우회 가능)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: '게시물 수정' })
  @ApiBody({ type: UpdatePostZodDto })
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(UpdatePostZodDto))
  async updatePost(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Req() req: any,
      @Body() body: UpdatePostZodDto
  ) {
      return this.postsService.update(id, toViewer(req), body, req.headers['user-agent']);
  }

  @Delete(':id')
  // 비회원 비밀번호를 무작위로 대입해 보는 것을 막기 위해 횟수를 제한한다 (verify-password만 막으면 이쪽으로 우회 가능)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(UserStatusGuard)
  async deletePost(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Body() body: { guestPassword?: string },
      @Req() req: any
  ) {
      return this.postsService.remove(id, toViewer(req), body?.guestPassword, req.headers['user-agent']);
  }

  @Put(':id/hidden')
  @ApiOperation({ summary: '게시물 비공개/공개 전환 (Super Admin)' })
  async setHidden(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Body() body: { hidden?: boolean },
      @Req() req: any,
  ) {
      if (typeof body?.hidden !== 'boolean') {
          throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.BAD_REQUEST, 'hidden 값(true/false)이 필요합니다.');
      }
      return this.postsService.setHidden(id, toViewer(req), body.hidden);
  }

  @Post(':id/verify-password')
  // 비회원 비밀번호를 무작위로 대입해 보는 것을 막기 위해 작성과 같은 수준으로 제한
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyPassword(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Body() body: { password: string }
  ) {
      return this.postsService.verifyPassword(id, body.password);
  }

  @Post(':id/reaction')
  @ApiOperation({ summary: '게시물 리액션 토글' })
  @ApiBody({ type: TogglePostReactionZodDto })
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(TogglePostReactionZodDto))
  async toggleReaction(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Body() body: TogglePostReactionZodDto,
      @Req() req: any
  ) {
      return this.postsService.toggleReaction(id, toViewer(req), body.type, req.headers['user-agent']);
  }
}

