import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CreateCommentZodDto, UpdateCommentZodDto } from '../../common/dto/zod-dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CommentsService } from './comments.service';

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
    const userId = req.user?.id;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.commentsService.create(userId, createCommentDto, ip as string, userAgent);
  }

  @Get()
  findAll(
      @Query('targetType') targetType: string,
      @Query('targetId') targetId: string,
      @Query('page') page: string = '1',
      @Query('limit') limit: string = '100',
      @Req() req: any
  ) {
    const userId = req.user?.id;
    const ip = req.ip || req.connection.remoteAddress;
    return this.commentsService.getCommentsByTarget(
      targetType, 
      targetId, 
      userId, 
      ip,
      parseInt(page),
      parseInt(limit)
    );
  }

  @Get('user/:userId')
  findByUser(
    @Param('userId') userId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    return this.commentsService.findByUser(userId, parseInt(page), parseInt(limit));
  }

  @Patch(':id')
  @ApiOperation({ summary: '댓글 수정' })
  @ApiBody({ type: UpdateCommentZodDto })
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(UpdateCommentZodDto))
  update(
      @Param('id') id: string, 
      @Body() updateCommentDto: UpdateCommentZodDto,
      @Req() req: any
  ) {
      const userId = req.user?.id;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      return this.commentsService.update(id, userId, updateCommentDto, ip as string, userAgent);
  }

  @Delete(':id')
  @UseGuards(UserStatusGuard)
  remove(
      @Param('id') id: string, 
      @Body() body: { guestPassword?: string },
      @Req() req: any
  ) {
      const userId = req.user?.id;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      return this.commentsService.remove(id, userId, body.guestPassword, ip as string, userAgent);
  }

  @Post(':id/reaction')
  @UseGuards(UserStatusGuard)
  toggleReaction(
      @Param('id') id: string,
      @Body() body: { type: 'like' | 'dislike' },
      @Req() req: any
  ) {
      const userId = req.user?.id;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      return this.commentsService.toggleReaction(id, userId, body.type, ip as string, userAgent);
  }
}
