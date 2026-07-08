import { z } from 'zod';
import { User } from './auth';

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  readAt?: string | Date | null;
  deletedBySender: boolean;
  deletedByReceiver: boolean;
  createdAt: string | Date;
  
  // Populated fields
  sender?: Pick<User, 'id' | 'name' | 'picture'>;
  receiver?: Pick<User, 'id' | 'name' | 'picture'>;
}

export const SendMessageSchema = z.object({
  receiverId: z.string().uuid('올바른 사용자 ID 형식이 아닙니다.'),
  content: z.string().min(1, '메시지 내용을 입력해주세요.').max(1000, '메시지는 최대 1000자까지 가능합니다.'),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;
