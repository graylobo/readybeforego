import { Body, Controller, Delete, Get, Patch, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CHAT_LIMITS, CHAT_ROOM_DEFAULT, USER_ROLES } from '@community/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ClaimGuestNicknameZodDto } from '../../common/dto/zod-dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ChatService, isChatDomainError, toHttpException } from './chat.service';
import { ChatSettingsService } from './chat-settings.service';
import { ChatGateway } from './chat.gateway';
import { UpdateChatSettingsZodDto } from './dto/chat-settings.dto';

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
      this.chatGateway.broadcastHistoryClear(result.room);
      return result;
    } catch (error) {
      this.rethrow(error);
    }
  }

  private rethrow(error: unknown): never {
    if (isChatDomainError(error)) {
      throw toHttpException(error);
    }
    throw error;
  }
}
