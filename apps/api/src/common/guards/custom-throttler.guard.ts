import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerException } from '@nestjs/throttler';
import { getClientIp } from '../utils/client-ip';
import { LOCAL_THROTTLE_KEY_PREFIX } from './split-throttler.storage';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected errorMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';

  // 웹 서버(SSR)가 대신 보낸 요청도 실제 사용자 IP 기준으로 횟수를 센다
  // (기본값 req.ip를 쓰면 모든 방문자의 SSR 요청이 웹 서버 IP 하나의 한도를 나눠 쓰게 됨)
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(getClientIp(req as any) ?? 'unknown');
  }

  // 조회 요청은 서버 메모리에서 세도록 키에 표시한다 (SplitThrottlerStorage 참고)
  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const key = super.generateKey(context, suffix, name);
    const method = context.getType() === 'http' ? context.switchToHttp().getRequest()?.method : undefined;
    return READ_METHODS.has(method) ? `${LOCAL_THROTTLE_KEY_PREFIX}${key}` : key;
  }

  protected throwThrottlerException(): Promise<void> {
    throw new ThrottlerException(this.errorMessage);
  }
}
