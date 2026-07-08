import { z } from 'zod';

// 댓글 대상 타입
export const CommentTargetTypeSchema = z.enum(['post', 'comment']).or(z.string());
export type CommentTargetType = z.infer<typeof CommentTargetTypeSchema>;

export interface Comment {
  id: string;
  targetId: string;
  targetType: CommentTargetType;
  userId?: string | null;
  guestName?: string | null;
  guestPassword?: string | null;
  ipAddress?: string | null;
  parentId: string | null;
  content?: string | null;
  emoticonUrl?: string | null;
  imageUrl?: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentTree {
  id: string;
  targetId: string;
  targetType: CommentTargetType;
  userId?: string | null;
  guestName?: string | null;
  ipAddress?: string | null;
  userName: string | null;
  userEmail: string | null;
  userPicture: string | null;
  parentId: string | null;
  content?: string | null;
  emoticonUrl?: string | null;
  imageUrl?: string | null;
  isDeleted: boolean;
  upvoteCount: number;
  downvoteCount: number;
  isUpvoted: boolean;
  isDownvoted: boolean;
  createdAt: string;
  updatedAt: string;
  replies: CommentTree[];
}

export const CreateCommentSchema = z.object({
  targetId: z.string(),
  targetType: CommentTargetTypeSchema,
  content: z.string().max(1000, '댓글은 1000자 이내로 입력해주세요.').optional(),
  emoticonUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  parentId: z.string().optional(),
  guestName: z.string()
    .min(1, '닉네임을 입력해주세요.')
    .min(2, '닉네임은 2자 이상이어야 합니다.')
    .max(20)
    .optional(),
  guestPassword: z.string()
    .min(1, '비밀번호를 입력해주세요.')
    .min(4, '비밀번호는 4자 이상이어야 합니다.')
    .max(20)
    .optional(),
}).refine(data => data.content?.trim() || data.emoticonUrl || data.imageUrl, {
  message: '내용을 입력해주세요.',
  path: ['content'],
});
export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;

export const UpdateCommentSchema = z.object({
  content: z.string().max(1000, '댓글은 1000자 이내로 입력해주세요.').optional(),
  emoticonUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  guestPassword: z.string()
    .min(1, '비밀번호를 입력해주세요.')
    .min(4, '비밀번호는 4자 이상이어야 합니다.')
    .max(20)
    .optional(),
}).refine(data => data.content?.trim() || data.emoticonUrl || data.imageUrl, {
  message: '내용을 입력해주세요.',
  path: ['content'],
});
export type UpdateCommentDto = z.infer<typeof UpdateCommentSchema>;
