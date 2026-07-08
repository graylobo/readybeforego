import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiResponse } from '@community/shared-types';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    // SSE(text/event-stream) 응답은 표준 envelope로 감싸면 안 된다.
    // 감쌀 경우 MessageEvent의 data/id 필드가 중첩·소실되어 Last-Event-ID 백필이 깨진다.
    const request = context.switchToHttp().getRequest();
    const accept = request?.headers?.accept;
    if (typeof accept === 'string' && accept.includes('text/event-stream')) {
      return next.handle() as Observable<ApiResponse<T>>;
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
