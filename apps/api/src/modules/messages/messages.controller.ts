import { Controller, Get, Post, Delete, Param, UseGuards, Req, Body, Query, UsePipes } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SendMessageZodDto } from '../../common/dto/zod-dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: '쪽지 보내기' })
  @ApiBody({ type: SendMessageZodDto })
  @UseGuards(UserStatusGuard)
  @UsePipes(new ZodValidationPipe(SendMessageZodDto))
  async send(@Req() req: any, @Body() body: SendMessageZodDto) {
    return this.messagesService.sendMessage(req.user.id, body.receiverId, body.content);
  }

  @Get('received')
  async findAllReceived(
    @Req() req: any, 
    @Query('page') page: string = '1', 
    @Query('limit') limit: string = '20'
  ) {
    return this.messagesService.findAllReceived(req.user.id, Number(page), Number(limit));
  }

  @Get('sent')
  async findAllSent(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    return this.messagesService.findAllSent(req.user.id, Number(page), Number(limit));
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.messagesService.getUnreadCount(req.user.id);
    return { count };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.messagesService.findOne(id, req.user.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.messagesService.remove(id, req.user.id);
  }
}
