import { z } from 'zod';

export const EmoticonItemSchema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
  order: z.number().int().default(0),
});

export const CreateEmoticonPackSchema = z.object({
  title: z.string().min(1, "이모티콘 제목을 입력해주세요").max(50),
  description: z.string().optional(),
  price: z.number().int().min(0),
  thumbnailUrl: z.string().url(),
  emoticons: z.array(EmoticonItemSchema).min(5, "최소 5개의 이모티콘을 등록해야 합니다").max(15, "최대 15개까지만 등록할 수 있습니다"),
});

export type CreateEmoticonPackDto = z.infer<typeof CreateEmoticonPackSchema>;

export const UpdateEmoticonPackSchema = CreateEmoticonPackSchema;
export type UpdateEmoticonPackDto = z.infer<typeof UpdateEmoticonPackSchema>;

export const UpdateEmoticonPackStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  rejectionReason: z.string().optional(),
});

export type UpdateEmoticonPackStatusDto = z.infer<typeof UpdateEmoticonPackStatusSchema>;

export interface EmoticonItem {
  id: string;
  packId: string;
  url: string;
  name: string | null;
  order: number;
  createdAt: string | Date;
}

export interface EmoticonPack {
  id: string;
  authorId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string;
  price: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  salesCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;

  emoticons?: EmoticonItem[];
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface UserEmoticonPack {
  id: string;
  userId: string;
  packId: string;
  purchasedAt: string | Date;
  expiresAt: string | Date | null;
  
  pack?: EmoticonPack;
}
