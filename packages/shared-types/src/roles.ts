/**
 * 역할/권한 판별 (zod 없음).
 * 입력 규칙(zod 스키마)과 분리해 두어, 화면에서 isAdmin만 가져와도 zod가 웹 번들에 들어가지 않게 한다.
 */
export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';

export const USER_ROLES = {
  USER: 'user' as const,
  MODERATOR: 'moderator' as const,
  ADMIN: 'admin' as const,
  SUPER_ADMIN: 'super_admin' as const,
} as const;

export const ROLE_LEVELS: Record<string, number> = {
  user: 0,
  moderator: 10,
  admin: 50,
  super_admin: 100,
};

// 저장된 역할 값의 대소문자/기호가 달라도(예: SUPER_ADMIN, super-admin) 같은 역할로 본다
export const hasRole = (userRole: string | undefined, requiredRole: string): boolean => {
  if (!userRole) return false;
  const normalizedUserRole = userRole.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const normalizedRequiredRole = requiredRole.toLowerCase().replace(/[^a-z0-9_]/g, '');

  // super_admin은 모든 권한 통과
  if (normalizedUserRole === 'super_admin' || normalizedUserRole === 'superadmin') return true;

  const userLevel = ROLE_LEVELS[normalizedUserRole] ?? (normalizedUserRole === 'admin' ? 50 : 0);
  const requiredLevel = ROLE_LEVELS[normalizedRequiredRole] ?? (normalizedRequiredRole === 'admin' ? 50 : 0);

  return userLevel >= requiredLevel;
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
