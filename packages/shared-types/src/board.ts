import { z } from 'zod';

// 게시판 타입
export type BoardType = 'system' | 'user';

export interface Board {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: BoardType;
  isActive: boolean;
  allowAnonymous: boolean;
  isPrivate: boolean;
  viewMode: 'list' | 'lounge' | 'feed';
  createdAt: string;
  updatedAt: string;
}

export const CreateBoardSchema = z.object({
  slug: z.string().min(2).max(50),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  allowAnonymous: z.boolean().default(false),
  viewMode: z.enum(['list', 'lounge', 'feed']).default('list').optional(),
});
export type CreateBoardDto = z.infer<typeof CreateBoardSchema>;

export const UpdateBoardSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  viewMode: z.enum(['list', 'lounge', 'feed']).optional(),
});
export type UpdateBoardDto = z.infer<typeof UpdateBoardSchema>;

// 게시글 타입
export interface Post {
  id: string;
  boardId: string;
  userId?: string;
  guestName?: string | null;
  guestPassword?: string | null;
  title: string;
  category?: string | null;
  content: string;
  viewCount: number;
  isPinned: boolean;
  isNotice: boolean;
  allowComments: boolean;
  receiveCommentNotification: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  user?: {
    id: string;
    name: string;
    picture: string | null;
  } | null;
  board?: {
    id: string;
    slug: string;
    name: string;
  };
  likeCount?: number;
  dislikeCount?: number;
  commentCount?: number;
  userReaction?: 'like' | 'dislike' | null;
  isScrapped?: boolean;
  hasImage?: boolean;
}

export interface PostListItem {
  id: string;
  boardId: string;
  title: string;
  category?: string | null;
  viewCount: number;
  isPinned: boolean;
  isNotice: boolean;
  userId?: string;
  guestName?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    picture: string | null;
  } | null;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  hasImage: boolean;
}

export const CreatePostSchema = z.object({
  boardSlug: z.string(),
  title: z.string().min(1, '제목을 입력해주세요.').max(200),
  content: z.string().min(1, '내용을 입력해주세요.'),
  category: z.string().optional(),
  guestName: z.string().min(2).max(20).optional(),
  guestPassword: z.string().min(4).max(20).optional(),
  isNotice: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isBest: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  receiveCommentNotification: z.boolean().optional(),
});
export type CreatePostDto = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  isPinned: z.boolean().optional(),
  isNotice: z.boolean().optional(),
  isBest: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  receiveCommentNotification: z.boolean().optional(),
  guestPassword: z.string().min(4).max(20).optional(),
});
export type UpdatePostDto = z.infer<typeof UpdatePostSchema>;

// 게시글 리액션 타입
export const PostReactionTypeSchema = z.enum(['like', 'dislike']);
export type PostReactionType = z.infer<typeof PostReactionTypeSchema>;

export const TogglePostReactionSchema = z.object({
  type: PostReactionTypeSchema,
});
export type TogglePostReactionDto = z.infer<typeof TogglePostReactionSchema>;
