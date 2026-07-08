import { z } from 'zod';

export enum PointActionType {
  POST_CREATED = 'POST_CREATED',
  COMMENT_CREATED = 'COMMENT_CREATED',
  DAILY_LOGIN = 'DAILY_LOGIN',
}

export interface PointPolicy {
  id: string;
  actionType: PointActionType;
  experiencePoints: number;
  availablePoints: number;
  description: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export const UpdatePointPolicySchema = z.object({
  experiencePoints: z.number().min(0).optional(),
  availablePoints: z.number().min(0).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export type UpdatePointPolicyDto = z.infer<typeof UpdatePointPolicySchema>;
