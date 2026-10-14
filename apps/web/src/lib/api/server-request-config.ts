import type { AxiosRequestConfig } from 'axios';
import { cookies, headers } from 'next/headers';

/**
 * 서버 렌더링(SSR)에서 API를 호출할 때 쓰는 요청 설정 (서버 컴포넌트 전용)
 *
 * - 로그인 사용자 기준으로 조회되도록 요청 쿠키를 그대로 전달
 * - SSR 요청은 API 입장에서 웹 서버(Vercel) IP로 들어오므로, 실제 방문자 IP를 X-Client-IP로 전달한다.
 *   API는 서버끼리만 아는 비밀값(SSR_INTERNAL_SECRET)이 맞을 때만 이 값을 믿는다.
 *   (비밀값은 NEXT_PUBLIC_이 아닌 서버 전용 환경변수라 브라우저 번들에 포함되지 않음)
 */
/**
 * 서버 렌더링 결과가 '이 방문자' 기준인지 (방문자 IP를 API에 전달할 수 있는지).
 * 비회원의 추천 여부는 IP로 판단하므로, 전달하지 못하면 브라우저에서 다시 받아야 정확하다
 */
export async function isServerViewForVisitor(): Promise<boolean> {
  const headerStore = await headers();
  return !!process.env.SSR_INTERNAL_SECRET && !!getVisitorIp(headerStore);
}

function getVisitorIp(headerStore: Awaited<ReturnType<typeof headers>>): string | null {
  // Vercel은 x-forwarded-for를 실제 접속 IP로 덮어써서 넘겨준다 (사용자가 보낸 값은 버려짐)
  return headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || headerStore.get('x-real-ip');
}

export async function getServerRequestConfig(): Promise<AxiosRequestConfig | undefined> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const requestHeaders: Record<string, string> = {};

  const cookieString = cookieStore.toString();
  if (cookieString) requestHeaders.Cookie = cookieString;

  const secret = process.env.SSR_INTERNAL_SECRET;
  const clientIp = getVisitorIp(headerStore);
  if (secret && clientIp) {
    requestHeaders['X-SSR-Secret'] = secret;
    requestHeaders['X-Client-IP'] = clientIp;
  }

  return Object.keys(requestHeaders).length > 0 ? { headers: requestHeaders } : undefined;
}
