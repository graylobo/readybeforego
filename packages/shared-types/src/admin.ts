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

/** 시스템 관리자가 회원에게 포인트를 지급 (사용 가능 포인트만, 레벨에 쓰는 누적 포인트는 그대로) */
export const GrantPointsSchema = z.object({
  amount: z
    .number()
    .int('포인트는 정수로 입력해주세요.')
    .min(1, '1포인트 이상 지급해주세요.')
    .max(1_000_000, '한 번에 1,000,000포인트까지 지급할 수 있습니다.'),
  reason: z.string().trim().min(1, '지급 사유를 입력해주세요.').max(200),
});
export type GrantPointsDto = z.infer<typeof GrantPointsSchema>;
