import { z } from 'zod';

export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';

export const USER_ROLES = {
  USER: 'user' as const,
  MODERATOR: 'moderator' as const,
  ADMIN: 'admin' as const,
  SUPER_ADMIN: 'super_admin' as const,
} as const;

export const ROLE_LEVELS: Record<UserRole, number> = {
  user: 0,
  moderator: 10,
  admin: 50,
  super_admin: 100,
};

export const hasRole = (userRole: UserRole | undefined, requiredRole: UserRole): boolean => {
  if (!userRole) return false;
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
};

export const isStaff = (role: UserRole | undefined): boolean => {
  return hasRole(role, 'moderator');
};

export const isAdmin = (role: UserRole | undefined): boolean => {
  return hasRole(role, 'admin');
};

export const isSuperAdmin = (role: UserRole | undefined): boolean => {
  return hasRole(role, 'super_admin');
};

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
