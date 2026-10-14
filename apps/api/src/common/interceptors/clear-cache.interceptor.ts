import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';

export function ClearCacheInterceptor(pattern: string) {
  @Injectable()
  class MixinClearCacheInterceptor implements NestInterceptor {
    constructor(@Inject(CACHE_MANAGER) public readonly cacheManager: Cache) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      // 캐시를 다 지운 뒤에 응답한다. tap(async)는 기다리지 않아, 응답을 받은 화면이 곧바로 다시 조회하면
      // 아직 지워지지 않은 옛 캐시를 받았다 (관리자가 바꾼 설정이 늦게 반영)
      return next.handle().pipe(
        concatMap(async (res) => {
          try {
            // keyv-redis stores keys directly.
            // When using standard cacheManager without key tracking, we might need a workaround.
            // For simple prefixes, clearing all or specific hardcoded keys is common.
            // As a fallback for simple implementations without full scan support, we clear specific keys.
            // In a production redis environment, you would use a redis scan cursor.
            
            // To be safe in standard cache-manager v6+, we can clear the entire cache or specific known endpoints
            // until a wildcard implementation is added. Re-fetching boards is cheap enough to clear the board cache entirely.
            
            if (pattern === '/settings') {
                await this.cacheManager.del('/settings');
            }
            if (pattern === '/boards*') {
                await this.cacheManager.del('/boards');
                await this.cacheManager.del('/boards/admin/all');
                
                // If a board object with slug is returned in response, clear its specific detail cache
                if (res?.board?.slug) {
                    await this.cacheManager.del(`/boards/${res.board.slug}`);
                }
            }
          } catch (error) {
            console.error('Failed to clear cache:', error);
          }
          return res;
        }),
      );
    }
  }

  return MixinClearCacheInterceptor;
}
