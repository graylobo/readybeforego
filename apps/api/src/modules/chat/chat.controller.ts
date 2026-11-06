import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CHAT_LIMITS, CHAT_ROOM_DEFAULT, USER_ROLES } from '@community/shared-types';
import type { ChatSession } from '@community/shared-types';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClaimGuestNicknameZodDto } from '../../common/dto/zod-dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ChatService, isChatDomainError, toHttpException } from './chat.service';
import { ChatSettingsService } from './chat-settings.service';
import { ChatGateway } from './chat.gateway';
import { UpdateChatSettingsZodDto } from './dto/chat-settings.dto';

// 채팅 보내기 (Supabase Realtime을 쓸 때 화면이 웹소켓 대신 이 요청으로 보낸다)
const SendChatMessageSchema = z.object({
  content: z.string().max(2000),
  replyToId: z.string().max(100).optional(),
  room: z.string().max(100).optional(),
});

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatSettings: ChatSettingsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: '채팅 모듈 설정 조회 (공개: 옵트인 마운트용)' })
  async getSettings() {
    return this.chatSettings.getSettings();
  }

  @Patch('settings')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN)
  @UsePipes(new ZodValidationPipe(UpdateChatSettingsZodDto))
  @ApiBody({ type: UpdateChatSettingsZodDto })
  @ApiOperation({ summary: '채팅 모듈 설정 업데이트 (관리자 전용)' })
  async updateSettings(@Body() data: UpdateChatSettingsZodDto) {
    return this.chatSettings.updateSettings(data);
  }

  @Post('guest/claim')
  @ApiOperation({ summary: '비회원 채팅 닉네임 설정 (브라우저에만 저장할 토큰 발급)' })
  @ApiBody({ type: ClaimGuestNicknameZodDto })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UsePipes(new ZodValidationPipe(ClaimGuestNicknameZodDto))
  async claimGuest(@Body() body: ClaimGuestNicknameZodDto) {
    try {
      return await this.chatService.claimGuestNickname(body.nickname);
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Get('messages')
  @ApiOperation({ summary: '채팅 최근 메시지 조회' })
  async getMessages(
    @Query('room') room?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const parsedLimit = limit ? Number(limit) : CHAT_LIMITS.HISTORY_DEFAULT;
      const messages = await this.chatService.getRecentMessages(
        room || CHAT_ROOM_DEFAULT,
        Number.isFinite(parsedLimit) ? parsedLimit : CHAT_LIMITS.HISTORY_DEFAULT,
      );
      return { messages };
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Get('online')
  @ApiOperation({ summary: '채팅 접속자 수 조회' })
  async getOnline(@Query('room') room?: string) {
    try {
      const count = await this.chatService.getOnlineCount(room || CHAT_ROOM_DEFAULT);
      return { count };
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete('messages')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: '채팅 기록 전체 삭제 (관리자 전용)' })
  async clearMessages(@Query('room') room?: string) {
    try {
      const result = await this.chatService.clearHistory(room || CHAT_ROOM_DEFAULT);
      await this.chatGateway.broadcastHistoryClear(result.room);
      return result;
    } catch (error) {
      this.rethrow(error);
    }
  }

  /*
   * 아래 세 요청은 Supabase Realtime을 쓸 때(REALTIME_PROVIDER=supabase) 웹소켓 이벤트(JOIN/SEND/DELETE) 대신 쓴다.
   * 받기는 브라우저가 Supabase 채널로 하므로, 이 서버는 보낼 때만 짧게 일한다.
   * 회원은 로그인 쿠키(access_token), 비회원은 x-guest-token 머리말로 누구인지 확인한다 (웹소켓 연결 때와 같은 방식)
   */
  @Get('session')
  @ApiOperation({ summary: '채팅에서 나의 역할·닉네임 (회원/비회원/구경)' })
  async getSession(@Req() req: any, @Headers('x-guest-token') guestToken?: string): Promise<ChatSession> {
    try {
      this.chatService.assertLive();
      const identity = await this.resolveIdentity(req, guestToken);
      return {
        role: identity?.kind ?? 'spectator',
        nickname: identity?.nickname ?? null,
        userId: identity?.kind === 'member' ? identity.userId : null,
        guestId: identity?.kind === 'guest' ? identity.guestId : null,
      };
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Post('messages')
  @Throttle({ default: { ttl: 60000, limit: 40 } })
  @ApiOperation({ summary: '채팅 메시지 보내기' })
  @UsePipes(new ZodValidationPipe(SendChatMessageSchema))
  async sendMessage(
    @Req() req: any,
    @Body() body: z.infer<typeof SendChatMessageSchema>,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    try {
      this.chatService.assertLive();
      const identity = await this.chatService.assertCanSend(await this.resolveIdentity(req, guestToken));
      const message = await this.chatService.sendMessage(identity, body.content, body.room, body.replyToId);
      await this.chatGateway.publishMessage(message.roomSlug, message);
      return message;
    } catch (error) {
      this.rethrow(error);
    }
  }

  @Delete('messages/:id')
  @Throttle({ default: { ttl: 60000, limit: 40 } })
  @ApiOperation({ summary: '채팅 메시지 삭제 (삭제 권한이 있는 사람)' })
  async deleteMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Query('room') room?: string,
    @Headers('x-guest-token') guestToken?: string,
  ) {
    try {
      this.chatService.assertLive();
      const identity = await this.chatService.assertCanSend(await this.resolveIdentity(req, guestToken));
      const result = await this.chatService.deleteMessage(identity, id, room);
      await this.chatGateway.publishMessageDeleted(result.room, result);
      return result;
    } catch (error) {
      this.rethrow(error);
    }
  }

  private resolveIdentity(req: any, guestToken?: string) {
    return this.chatService.resolveHandshake({ cookieHeader: req.headers?.cookie, guestToken });
  }

  private rethrow(error: unknown): never {
    if (isChatDomainError(error)) {
      throw toHttpException(error);
    }
    throw error;
  }
}
