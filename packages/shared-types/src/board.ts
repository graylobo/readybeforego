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
  /** 읽기 전용: 글은 보이지만 새 글/댓글을 받지 않음 */
  isReadOnly?: boolean;
  /** 게시판 화면에 매니저·부매니저 이름을 보여줄지 */
  showManagers?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 게시판 관리자 역할: 매니저(1명) / 부매니저 */
export type BoardManagerRole = 'manager' | 'sub_manager';

/** 게시판 하나에 둘 수 있는 부매니저 수 */
export const BOARD_SUB_MANAGER_LIMIT = 3;

export interface BoardManager {
  userId: string;
  name: string | null;
  picture: string | null;
  role: BoardManagerRole;
}

export type BoardRequestStatus = 'pending' | 'approved' | 'rejected';

export interface BoardRequest {
  id: string;
  requesterId: string;
  slug: string;
  name: string;
  description: string | null;
  reason: string | null;
  status: BoardRequestStatus;
  rejectReason: string | null;
  reviewedAt: string | null;
  boardId: string | null;
  createdAt: string;
  requester?: { id: string; name: string | null; email: string | null } | null;
}

// 'best', 'all'은 인기글/전체글 화면이 쓰는 주소라 게시판 주소로 만들 수 없다
const RESERVED_BOARD_SLUGS = ['best', 'all'];

// 게시판 주소(/board/{slug})에 그대로 쓰이므로 영문 소문자·숫자·하이픈만 허용
const BoardSlugSchema = z.string()
  .min(2, '게시판 주소는 2자 이상이어야 합니다.')
  .max(50, '게시판 주소는 50자 이내로 입력해주세요.')
  .regex(/^[a-z0-9-]+$/, '게시판 주소는 영문 소문자, 숫자, 하이픈(-)만 쓸 수 있습니다.')
  .refine((slug) => !RESERVED_BOARD_SLUGS.includes(slug), '이미 사이트에서 쓰는 주소라 쓸 수 없습니다.');
const BoardNameSchema = z.string().min(2, '게시판 이름은 2자 이상이어야 합니다.').max(100, '게시판 이름은 100자 이내로 입력해주세요.');
const BoardDescriptionSchema = z.string().max(500, '설명은 500자 이내로 입력해주세요.');

export const CreateBoardSchema = z.object({
  slug: BoardSlugSchema,
  name: BoardNameSchema,
  description: BoardDescriptionSchema.optional(),
  allowAnonymous: z.boolean().default(false),
  viewMode: z.enum(['list', 'lounge', 'feed']).default('list').optional(),
  // 관리자 화면이 보내는 값. 스키마에 없으면 검사 단계에서 빠져 비공개로 만들어도 공개 게시판이 됐다
  isPrivate: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateBoardDto = z.infer<typeof CreateBoardSchema>;

export const UpdateBoardSchema = z.object({
  name: BoardNameSchema.optional(),
  description: BoardDescriptionSchema.optional(),
  isActive: z.boolean().optional(),
  allowAnonymous: z.boolean().optional(),
  viewMode: z.enum(['list', 'lounge', 'feed']).optional(),
  isReadOnly: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  showManagers: z.boolean().optional(),
});
export type UpdateBoardDto = z.infer<typeof UpdateBoardSchema>;

// 게시판 개설 신청 (회원 누구나)
export const CreateBoardRequestSchema = z.object({
  slug: BoardSlugSchema,
  name: BoardNameSchema,
  description: BoardDescriptionSchema.optional(),
  reason: z.string().max(1000, '신청 사유는 1000자 이내로 입력해주세요.').optional(),
});
export type CreateBoardRequestDto = z.infer<typeof CreateBoardRequestSchema>;

// 개설 신청 처리 (사이트 관리자)
export const ReviewBoardRequestSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  rejectReason: z.string().max(500, '반려 사유는 500자 이내로 입력해주세요.').optional(),
});
export type ReviewBoardRequestDto = z.infer<typeof ReviewBoardRequestSchema>;

// 매니저가 고치는 게시판 설정 (보낸 항목만 바꾼다)
export const UpdateBoardSettingsSchema = z.object({
  description: BoardDescriptionSchema.optional(),
  showManagers: z.boolean().optional(),
});
export type UpdateBoardSettingsDto = z.infer<typeof UpdateBoardSettingsSchema>;

// 부매니저 지정(닉네임으로 찾음) / 매니저 변경(사이트 관리자)
export const AddSubManagerSchema = z.object({
  name: z.string().min(1, '닉네임을 입력해주세요.').max(50),
});
export const ChangeBoardManagerSchema = z.object({
  name: z.string().min(1, '닉네임을 입력해주세요.').max(50),
});

// 게시글 타입
export interface Post {
  id: string;
  boardId: string;
  /** 검색 결과에 넣지 않을 글 (크롤러가 가져온 글). 상세 응답에만 있음 */
  noIndex?: boolean;
  userId?: string;
  guestName?: string | null;
  title: string;
  category?: string | null;
  // 목록 응답에는 피드형 게시판 등 본문이 필요한 경우에만 포함된다 (상세 응답에는 항상 포함)
  content?: string;
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
  // 비공개 처리한 시각 (비공개 글은 Super Admin에게만 내려오므로 다른 사람에게는 항상 비어 있음)
  hiddenAt?: string | null;
  // Super Admin에게만 내려오는 값
  isBot?: boolean;
  botSource?: {
    // 수집 대상 카드 이름 (디시 갤러리 이름이 아님)
    targetName: string | null;
    // 카드가 삭제된 경우 null
    galleryId: string | null;
  } | null;
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
  isBot?: boolean;
  hiddenAt?: string | null;
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

// 본문 HTML 최대 길이. 이미지는 주소만 들어가므로 아주 긴 글도 이 안에 들어간다 (요청 크기 제한 10MB보다 훨씬 작게 막음)
export const POST_CONTENT_MAX_LENGTH = 200_000;

export const CreatePostSchema = z.object({
  boardSlug: z.string(),
  title: z.string().min(1, '제목을 입력해주세요.').max(200, '제목은 200자 이내로 입력해주세요.'),
  content: z.string().min(1, '내용을 입력해주세요.').max(POST_CONTENT_MAX_LENGTH, '본문이 너무 깁니다.'),
  category: z.string().optional(),
  // 화면에 그대로 보이는 문구라 기본(영어) 메시지 대신 한국어로 적는다
  guestName: z.string().min(2, '닉네임은 2자 이상이어야 합니다.').max(20, '닉네임은 20자 이내로 입력해주세요.').optional(),
  guestPassword: z.string().min(4, '비밀번호는 4자 이상이어야 합니다.').max(20, '비밀번호는 20자 이내로 입력해주세요.').optional(),
  isNotice: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isBest: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  receiveCommentNotification: z.boolean().optional(),
});
export type CreatePostDto = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.').max(200, '제목은 200자 이내로 입력해주세요.').optional(),
  content: z.string().min(1, '내용을 입력해주세요.').max(POST_CONTENT_MAX_LENGTH, '본문이 너무 깁니다.').optional(),
  isPinned: z.boolean().optional(),
  isNotice: z.boolean().optional(),
  isBest: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  receiveCommentNotification: z.boolean().optional(),
  guestPassword: z.string().min(4, '비밀번호는 4자 이상이어야 합니다.').max(20, '비밀번호는 20자 이내로 입력해주세요.').optional(),
});
export type UpdatePostDto = z.infer<typeof UpdatePostSchema>;

// 게시글 리액션 타입
export const PostReactionTypeSchema = z.enum(['like', 'dislike']);
export type PostReactionType = z.infer<typeof PostReactionTypeSchema>;

export const TogglePostReactionSchema = z.object({
  type: PostReactionTypeSchema,
});
export type TogglePostReactionDto = z.infer<typeof TogglePostReactionSchema>;
