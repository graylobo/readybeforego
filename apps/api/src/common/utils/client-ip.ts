import { timingSafeEqual } from 'crypto';

/**
 * 요청 사용자 IP 판별
 *
 * X-Forwarded-For 헤더의 맨 앞 값은 사용자가 마음대로 넣어 보낼 수 있으므로 믿지 않는다.
 * 대신 앞단 프록시(Cloud Run의 Google Front End 등)가 맨 뒤에 덧붙인 값만 믿는다.
 * - 믿을 프록시 수는 TRUST_PROXY_HOPS (기본 1: Cloud Run). 프록시 없이 직접 받는 환경이면 0
 * - 웹 서버(Next.js SSR)가 대신 보내는 요청은 사용자 IP가 아니라 웹 서버 IP로 들어오므로,
 *   서버끼리만 아는 비밀값(SSR_INTERNAL_SECRET)이 맞을 때에 한해 X-Client-IP 헤더의 사용자 IP를 사용한다.
 */

export const SSR_SECRET_HEADER = 'x-ssr-secret';
export const SSR_CLIENT_IP_HEADER = 'x-client-ip';

export function getTrustProxyHops(): number {
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
  return Number.isInteger(hops) && hops >= 0 ? hops : 1;
}

function normalizeIp(ip: string | undefined | null): string | undefined {
  const trimmed = ip?.trim();
  if (!trimmed) return undefined;
  // IPv4가 IPv6 형태(::ffff:1.2.3.4)로 들어오는 경우 통일
  return trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isTrustedSsrRequest(headers: Record<string, string | string[] | undefined>): boolean {
  const expected = process.env.SSR_INTERNAL_SECRET;
  const received = headerValue(headers[SSR_SECRET_HEADER]);
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// 앞단 프록시가 붙인 X-Forwarded-For 값 중 믿을 수 있는 위치의 IP (Express trust proxy=N 과 같은 규칙)
export function pickForwardedIp(
  forwardedFor: string | undefined,
  remoteAddress: string | undefined,
  hops: number = getTrustProxyHops(),
): string | undefined {
  const chain = (forwardedFor ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (hops === 0 || chain.length === 0) return normalizeIp(remoteAddress);
  return normalizeIp(chain[Math.max(chain.length - hops, 0)]);
}

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

/**
 * HTTP 요청의 사용자 IP. (main.ts에서 trust proxy를 TRUST_PROXY_HOPS로 설정하므로 req.ip가 위 규칙을 따른다)
 */
export function getClientIp(req: RequestLike): string | undefined {
  if (isTrustedSsrRequest(req.headers)) {
    const ssrClientIp = normalizeIp(headerValue(req.headers[SSR_CLIENT_IP_HEADER]));
    if (ssrClientIp) return ssrClientIp;
  }
  return normalizeIp(req.ip ?? req.socket?.remoteAddress);
}
