'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminDashboard, useAdminDashboardTasks } from '@/hooks/queries/use-admin-queries';
import type { DashboardRangeDays } from '@/lib/api/admin';
import { cn } from '@/lib/utils';
import { RANGE_OPTIONS } from './components/dashboard/dashboard-config';
import { MetricCard, formatChange } from './components/dashboard/metric-card';
import { ModerationLogs } from './components/dashboard/moderation-logs';
import { PendingTasks } from './components/dashboard/pending-tasks';
import { SystemAlerts, SystemStatus } from './components/dashboard/system-status';
import { TopBoards } from './components/dashboard/top-boards';

export default function AdminDashboardPage() {
  const [days, setDays] = useState<DashboardRangeDays>(7);
  const dashboard = useAdminDashboard(days);
  const tasks = useAdminDashboardTasks();
  const data = dashboard.data;
  const range = RANGE_OPTIONS.find((option) => option.days === days) ?? RANGE_OPTIONS[1];
  const isRefreshing = dashboard.isFetching || tasks.isFetching;

  const refresh = () => {
    void dashboard.refetch();
    void tasks.refetch();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 md:gap-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">대시보드</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'M월 d일 (EEE)', { locale: ko })}
            {dashboard.dataUpdatedAt > 0 && ` · ${format(dashboard.dataUpdatedAt, 'HH:mm')} 기준`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={String(days)} onValueChange={(value) => setDays(Number(value) as DashboardRangeDays)}>
            <TabsList aria-label="기간">
              {RANGE_OPTIONS.map((option) => (
                <TabsTrigger key={option.days} value={String(option.days)} className="cursor-pointer px-3">
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="icon"
            onClick={refresh}
            disabled={isRefreshing}
            aria-label="새로고침"
            className="cursor-pointer"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </header>

      {data && <SystemAlerts systems={data.systems} />}

      <PendingTasks tasks={tasks.data} isLoading={tasks.isLoading} />

      <section aria-label="주요 지표" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {data ? (
            <>
              <MetricCard
                label="전체 사용자"
                value={data.metrics.users.total}
                increase={`${range.increaseLabel} +${data.metrics.users.current.toLocaleString()}`}
                detail={formatChange(data.metrics.users.current, data.metrics.users.previous)}
                series={data.metrics.users.series}
              />
              <MetricCard
                label="전체 게시글"
                value={data.metrics.posts.total}
                increase={`${range.increaseLabel} +${data.metrics.posts.current.toLocaleString()}`}
                detail={formatChange(data.metrics.posts.current, data.metrics.posts.previous)}
                series={data.metrics.posts.series}
              />
              <MetricCard
                label="전체 댓글"
                value={data.metrics.comments.total}
                increase={`${range.increaseLabel} +${data.metrics.comments.current.toLocaleString()}`}
                detail={formatChange(data.metrics.comments.current, data.metrics.comments.previous)}
                series={data.metrics.comments.series}
              />
              <MetricCard
                label="게시판"
                value={data.metrics.boards.total}
                increase={
                  data.metrics.boards.current > 0
                    ? `${range.increaseLabel} +${data.metrics.boards.current}`
                    : undefined
                }
                detail={`사용 중 ${data.metrics.boards.active.toLocaleString()}`}
              />
            </>
          ) : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[148px] rounded-xl" />)
          )}
        </div>
        <p className="text-xs text-muted-foreground">게시글·댓글은 봇(콘텐츠 수집기)이 등록한 것을 뺀 수입니다.</p>
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data ? (
          <>
            <TopBoards boards={data.topBoards} periodLabel={range.increaseLabel} />
            <SystemStatus systems={data.systems} />
            <div className="lg:col-span-2">
              <ModerationLogs logs={data.recentModerationLogs} />
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-56 rounded-xl lg:col-span-2" />
          </>
        )}
      </div>
    </div>
  );
}
