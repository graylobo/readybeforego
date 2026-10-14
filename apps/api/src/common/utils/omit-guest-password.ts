/**
 * 비회원 글/댓글의 비밀번호 해시(guestPassword)를 응답에서 제외한다.
 * 해시가 노출되면 받아 간 쪽에서 짧은 비밀번호를 대입해 원래 비밀번호를 알아낼 수 있으므로,
 * 비밀번호 확인이 필요한 서버 내부 로직 외에는 절대 내보내지 않는다.
 */
export function omitGuestPassword<T extends { guestPassword?: string | null }>(
  row: T,
): Omit<T, 'guestPassword'> {
  const copy: Partial<T> = { ...row };
  delete copy.guestPassword;
  return copy as Omit<T, 'guestPassword'>;
}
