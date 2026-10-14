import { z } from 'zod';
import type { UserRole } from './roles';

export type UserStatus = 'active' | 'suspended' | 'banned';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string | null;
  role?: UserRole;
  status: UserStatus;
  bannedUntil?: string | Date | null;
  warningCount: number;
  isProfileSetup?: boolean;
  accumulatedPoints?: number;
  availablePoints?: number;
  level?: number;
  nameChangeAt?: Date | string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface PublicUserProfile {
  id: string;
  name: string;
  picture?: string | null;
  level: number;
  accumulatedPoints: number;
  availablePoints: number;
  joinDate: string | Date;
}

export const UpdateUserSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(20).optional(),
  picture: z.string().optional(),
  isProfileSetup: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
