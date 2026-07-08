import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  // API 응답속도가 1000ms를 초과하면 Slow Query/Request 로 간주합니다.
  private readonly SLOW_REQUEST_THRESHOLD_MS = 1000; 

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const { method, originalUrl, ip } = req;
    
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = ctx.getResponse();
          const { statusCode } = res;
          const duration = Date.now() - startTime;

          // 기본적인 모든 요청을 로깅하고 싶지 않다면 아래 구문은 생략/주석 처리 가능
          // this.logger.log(`${method} ${originalUrl} ${statusCode} - ${userAgent} ${ip} [${duration}ms]`);

          // 🚨 슬로우 쿼리 방어 로깅 🚨
          if (duration > this.SLOW_REQUEST_THRESHOLD_MS) {
            this.logger.warn(`🐌 [SLOW API DETECTED] ${method} ${originalUrl} took ${duration}ms (Threshold: ${this.SLOW_REQUEST_THRESHOLD_MS}ms) - IP: ${ip}`);
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(`❌ [API ERROR] ${method} ${originalUrl} failed after ${duration}ms - IP: ${ip}`, error.stack);
        }
      }),
    );
  }
}
