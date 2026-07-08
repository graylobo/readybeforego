import { z } from 'zod';

export const WarnUserSchema = z.object({
  reason: z.string().min(1, '사유를 입력해주세요.').max(500),
});
export type WarnUserDto = z.infer<typeof WarnUserSchema>;

export const SuspendUserSchema = z.object({
  reason: z.string().min(1, '사유를 입력해주세요.').max(500),
  days: z.number().min(1, '정지 기간은 최소 1일 이상이어야 합니다.').max(3650),
});
export type SuspendUserDto = z.infer<typeof SuspendUserSchema>;

export const BanUserSchema = z.object({
  reason: z.string().min(1, '사유를 입력해주세요.').max(500),
});
export type BanUserDto = z.infer<typeof BanUserSchema>;

export const ReactivateUserSchema = z.object({
  reason: z.string().min(1, '사유를 입력해주세요.').max(500),
});
export type ReactivateUserDto = z.infer<typeof ReactivateUserSchema>;

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin', 'super_admin']),
});
export type UpdateUserRoleDto = z.infer<typeof UpdateUserRoleSchema>;
