import { Skeleton } from "@/components/ui/skeleton";

/**
 * 페이지 이동이 늦을 때 AppLayout이 본문 대신 보여주는 스켈레톤.
 * loading.tsx(Suspense 대체 화면)로 쓰지 않는다: React는 대체 화면을 한 번 보이면 실제 내용으로 바꾸기까지
 * 최소 300ms를 기다리므로, 데이터가 100ms 만에 와도 이동할 때마다 300ms 이상 걸린다.
 */
export function PageLoading() {
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Title area skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <Skeleton className="h-4 w-72 sm:w-96" />
      </div>

      {/* Main content grid/list skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-sm"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Rank number or icon */}
              <Skeleton className="h-6 w-6 rounded-md shrink-0" />
              {/* Avatar */}
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              {/* Name and additional info */}
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-4 w-32 sm:w-48 max-w-full" />
                <Skeleton className="h-3.5 w-24 sm:w-32 max-w-full" />
              </div>
            </div>
            {/* Right side stats */}
            <div className="flex items-center gap-4 shrink-0">
              <Skeleton className="h-5 w-16 sm:w-24 rounded-md" />
              <Skeleton className="h-8 w-16 sm:w-20 rounded-lg hidden sm:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
