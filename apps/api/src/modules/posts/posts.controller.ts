import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, Delete, Put, UsePipes, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreatePostZodDto, UpdatePostZodDto, TogglePostReactionZodDto } from '../../common/dto/zod-dto';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { ApiException } from 'src/common/exceptions/api.exception';
import { ErrorCode } from '@community/shared-types';


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
    @Query('isNotice') isNotice?: string
  ) {
      const userId = req.user?.id;
      return this.postsService.findAll(
        boardSlug, 
        parseInt(page), 
        parseInt(limit), 
        searchType, 
        searchQuery,
        userId,
        authorId,
        isBest,
        isNotice
      );
  }

  @Get('my/scrapped')
  async getMyScrapped(
      @Req() req: any,
      @Query('page') page: string = '1',
      @Query('limit') limit: string = '20',
  ) {
      if (!req.user) throw new Error('로그인이 필요합니다.');
      return this.postsService.findScrappedPosts(req.user.id, parseInt(page), parseInt(limit));
  }

  @Get(':id')
  async getPost(
    @Param('id') id: string, 
    @Req() req: any,
    @Query('increment') increment: string = 'false'
  ) {
      const userId = req.user?.id;
      const ip = req.ip || req.connection.remoteAddress;
      const shouldIncrement = increment === 'true';
      return this.postsService.findOne(id, userId, shouldIncrement, ip);
  }

  @Post(':id/scrap')
  async toggleScrap(
      @Param('id') id: string,
      @Req() req: any
  ) {
      if (!req.user) throw new Error('로그인이 필요합니다.');
      return this.postsService.toggleScrap(id, req.user.id);
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
      const userId = req.user?.id;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      return this.postsService.create(userId, body.boardSlug, body, ip as string, userAgent);
  }

  @Put(':id')
  @ApiOperation({ summary: '게시물 수정' })
  @ApiBody({ type: UpdatePostZodDto })
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(UpdatePostZodDto))
  async updatePost(
      @Param('id') id: string,
      @Req() req: any,
      @Body() body: UpdatePostZodDto
  ) {
      const userId = req.user?.id;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      return this.postsService.update(id, userId, body, ip as string, userAgent);
  }

  @Delete(':id')
  @UseGuards(UserStatusGuard)
  async deletePost(
      @Param('id') id: string,
      @Body() body: { guestPassword?: string },
      @Req() req: any
  ) {
      const userId = req.user?.id;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      return this.postsService.remove(id, userId, body.guestPassword, ip as string, userAgent);
  }

  @Post(':id/verify-password')
  async verifyPassword(
      @Param('id') id: string,
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
      @Param('id') id: string,
      @Body() body: TogglePostReactionZodDto,
      @Req() req: any
  ) {
      const userId = req.user?.id;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      return this.postsService.toggleReaction(id, userId, body.type, ip as string, userAgent);
  }
}

