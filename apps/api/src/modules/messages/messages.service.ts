import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepo: MessagesRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendMessage(senderId: string, receiverIdOrName: string, content: string) {
    console.log(`[MessagesService] sendMessage - senderId: ${senderId}, receiver: ${receiverIdOrName}`);
    
    // UUID 형식인지 확인 (더 엄격하게)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receiverIdOrName);
    console.log(`[MessagesService] isUuid: ${isUuid}`);
    
    let receiver;
    if (isUuid) {
      try {
        receiver = await this.messagesRepo.findUserById(receiverIdOrName);
      } catch (e) {
        console.error('[MessagesService] UUID query failed:', e);
        receiver = null;
      }
    } 
    
    // UUID로 못 찾았거나 UUID 형식이 아니면 이름으로 검색
    if (!receiver) {
      receiver = await this.messagesRepo.findUserByName(receiverIdOrName);
    }

    if (!receiver) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    if (senderId === receiver.id) {
      throw new BadRequestException('자기 자신에게는 쪽지를 보낼 수 없습니다.');
    }

    const receiverId = receiver.id;

    const [newMessage] = await this.messagesRepo.insertMessage({
        senderId,
        receiverId,
        content,
    });

    // 알림 생성
    const sender = await this.messagesRepo.findUserById(senderId);

    await this.notificationsService.create({
      userId: receiverId,
      actorId: senderId,
      type: 'MESSAGE',
      content: `${sender?.name || '누군가'}님으로부터 새로운 쪽지가 도착했습니다.`,
      targetId: newMessage.id,
      targetType: 'MESSAGE',
      link: '/messages', // 쪽지함 링크
    }).catch(e => console.error('Failed to create notification for message:', e));

    return newMessage;
  }

  async findAllReceived(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const items = await this.messagesRepo.findReceivedMessages(userId, offset, limit);
    const total = await this.messagesRepo.countReceivedMessages(userId);

    return { items, total };
  }

  async findAllSent(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const items = await this.messagesRepo.findSentMessages(userId, offset, limit);
    const total = await this.messagesRepo.countSentMessages(userId);

    return { items, total };
  }

  async findOne(id: string, userId: string) {
    const message = await this.messagesRepo.findMessageById(id);

    if (!message) throw new NotFoundException('쪽지를 찾을 수 없습니다.');

    // 권한 확인
    if (message.senderId !== userId && message.receiverId !== userId) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    // 읽음 처리 (수신자가 읽었을 때)
    if (message.receiverId === userId && !message.isRead) {
      await this.messagesRepo.transaction(async (tx) => {
          await this.messagesRepo.markMessageAsRead(id, tx);
          // 관련 알림도 읽음 처리
          await this.messagesRepo.markNotificationAsRead(userId, id, tx);
      });
      
      // 반환객체 업데이트
      message.isRead = true;
      message.readAt = new Date();
    }

    return message;
  }

  async remove(id: string, userId: string) {
    const message = await this.messagesRepo.findMessageById(id);

    if (!message) throw new NotFoundException('쪽지를 찾을 수 없습니다.');

    if (message.senderId === userId) {
      await this.messagesRepo.markMessageDeletedBySender(id);
    } else if (message.receiverId === userId) {
      await this.messagesRepo.markMessageDeletedByReceiver(id);
    } else {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }

    return { success: true };
  }

  async getUnreadCount(userId: string) {
    return this.messagesRepo.countUnreadMessages(userId);
  }
}
