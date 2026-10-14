'use client';

import React, { useState, useEffect } from 'react';
import { CrawlerTarget } from '@/lib/api/crawler';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from '@/lib/toast';
import {
  Timer,
  Clock,
  Plus,
  Sparkles,
  Infinity as InfinityIcon,
  Check,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Play,
  Square,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** 수집 주기 표시: 고정이면 '10분', 범위면 '5~10분' */
export function formatCrawlInterval(target: Pick<CrawlerTarget, 'crawlIntervalMinutes' | 'crawlIntervalMaxMinutes'>) {
  const min = target.crawlIntervalMinutes ?? 10;
  const max = target.crawlIntervalMaxMinutes;
  return max && max > min ? `${min}~${max}분` : `${min}분`;
}

interface TargetTimerControlProps {
  target: CrawlerTarget;
  onUpdate: (data: Partial<CrawlerTarget>) => void;
  isPending?: boolean;
}

export function TargetTimerControl({ target, onUpdate, isPending }: TargetTimerControlProps) {
  const [open, setOpen] = useState(false);
  const [customStopMinutes, setCustomStopMinutes] = useState<string>(
    target.autoStopMinutes > 0 ? String(target.autoStopMinutes) : ''
  );
  const [customIntervalMinutes, setCustomIntervalMinutes] = useState<string>(
    String(target.crawlIntervalMinutes ?? 10)
  );
  const [customIntervalMaxMinutes, setCustomIntervalMaxMinutes] = useState<string>(
    target.crawlIntervalMaxMinutes ? String(target.crawlIntervalMaxMinutes) : ''
  );
  const [now, setNow] = useState(Date.now());

  const isTimerActive = target.isActive && (target.autoStopMinutes ?? 0) > 0;
  const currentInterval = formatCrawlInterval(target);
  const isFixedInterval = !target.crawlIntervalMaxMinutes || target.crawlIntervalMaxMinutes <= target.crawlIntervalMinutes;

  // 타이머가 동작 중일 때만 1초마다 시간 갱신
  useEffect(() => {
    if (!isTimerActive) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive]);

  // target 값 변경 시 인풋 동기화
  useEffect(() => {
    if (target.autoStopMinutes > 0) {
      setCustomStopMinutes(String(target.autoStopMinutes));
    } else {
      setCustomStopMinutes('');
    }
    setCustomIntervalMinutes(String(target.crawlIntervalMinutes ?? 10));
    setCustomIntervalMaxMinutes(target.crawlIntervalMaxMinutes ? String(target.crawlIntervalMaxMinutes) : '');
  }, [target.autoStopMinutes, target.crawlIntervalMinutes, target.crawlIntervalMaxMinutes]);

  // 남은 시간 계산
  const activatedMs = target.activatedAt ? new Date(target.activatedAt).getTime() : now;
  const totalMs = (target.autoStopMinutes ?? 0) * 60 * 1000;
  const elapsedMs = Math.max(0, now - activatedMs);
  const remainMs = Math.max(0, totalMs - elapsedMs);

  const remainTotalSeconds = Math.floor(remainMs / 1000);
  const remainMinutes = Math.floor(remainTotalSeconds / 60);
  const remainSeconds = remainTotalSeconds % 60;
  const progressPercent = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0;

  /**
   * 1. 수집 주기 변경 (얼마나 자주 가져올지)
   */
  const handleSetIntervalMinutes = (min: number, max: number | null = null) => {
    onUpdate({ crawlIntervalMinutes: min, crawlIntervalMaxMinutes: max });
    toast.success(
      max && max > min
        ? `[${target.name}] 자동 수집 주기가 ${min}~${max}분 사이 무작위로 설정되었습니다.`
        : `[${target.name}] 자동 수집 주기가 ${min}분마다로 설정되었습니다.`
    );
  };

  /**
   * 2. 타이머 지속시간 설정 (총 몇 시간 돌릴지)
   */
  const handleSetTimerMinutes = (minutes: number) => {
    if (target.isActive) {
      onUpdate({
        autoStopMinutes: minutes,
        activatedAt: new Date().toISOString(),
      });
      toast.success(
        minutes === 0
          ? `[${target.name}] 무제한(상시) 수집으로 전환되었습니다.`
          : `[${target.name}] 타이머가 지금부터 ${minutes}분 후 자동종료로 재설정되었습니다.`
      );
    } else {
      onUpdate({
        autoStopMinutes: minutes,
      });
      toast.success(
        minutes === 0
          ? `[${target.name}] 무제한(상시)으로 설정되었습니다. (수집 시작: 우측 [시작] 클릭)`
          : `[${target.name}] ${minutes >= 60 ? `${Math.floor(minutes / 60)}시간` : `${minutes}분`} 타이머가 설정되었습니다. (수집 시작: 우측 [시작] 클릭)`
      );
    }
  };

  /**
   * 3. 수집 시작 실행 (우측 시작 버튼)
   */
  const handleStart = () => {
    onUpdate({
      isActive: true,
      activatedAt: new Date().toISOString(),
    });
    const timerLabel =
      (target.autoStopMinutes ?? 0) > 0
        ? `${target.autoStopMinutes}분 타이머`
        : '무제한';
    toast.success(`[${target.name}] ${currentInterval} 간격 · ${timerLabel} 수집을 시작합니다. (첫 수집은 1분 안에)`);
  };

  /**
   * 4. 수집 중지 실행 (우측 중지 버튼)
   */
  const handleStop = () => {
    onUpdate({
      isActive: false,
    });
    toast.info(`[${target.name}] 수집이 중지되었습니다.`);
  };

  /**
   * 시간 연장 (현재 동작 중일 때)
   */
  const handleExtend = (extraMinutes: number) => {
    const newMinutes = Math.max(1, remainMinutes + extraMinutes);
    onUpdate({
      autoStopMinutes: newMinutes,
      activatedAt: new Date().toISOString(),
    });
    toast.success(`[${target.name}] 타이머가 ${extraMinutes}분 연장되었습니다.`);
  };

  /**
   * 직접 수집 주기 입력 저장
   */
  const handleCustomIntervalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customIntervalMinutes, 10);
    if (isNaN(val) || val <= 0) {
      toast.error('1분 이상의 올바른 숫자를 입력해주세요.');
      return;
    }
    // 최대를 비우면 고정 주기
    const maxVal = customIntervalMaxMinutes.trim() === '' ? null : parseInt(customIntervalMaxMinutes, 10);
    if (maxVal !== null && (isNaN(maxVal) || maxVal < val)) {
      toast.error('최대는 최소 이상이어야 합니다 (고정 주기는 최대를 비워 두세요).');
      return;
    }
    handleSetIntervalMinutes(val, maxVal);
  };

  /**
   * 직접 타이머 입력 저장
   */
  const handleCustomStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customStopMinutes, 10);
    if (isNaN(val) || val < 0) {
      toast.error('0 이상의 올바른 숫자를 입력해주세요 (0은 무제한).');
      return;
    }
    handleSetTimerMinutes(val);
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border text-xs font-medium shadow-xs transition-all overflow-hidden',
        target.isActive
          ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300'
          : 'border-border/80 bg-background text-foreground hover:border-border'
      )}
    >
      {/* 1. 좌측 영역: 주기 및 타이머 시간 설정 (클릭 시 팝오버 오픈) */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors cursor-pointer border-r border-border/60 hover:bg-muted/60',
              target.isActive && 'hover:bg-amber-500/10'
            )}
            title="클릭하여 수집 주기(간격) 및 타이머 시간 설정"
          >
            {isTimerActive ? (
              <>
                <Timer className="h-3.5 w-3.5 text-amber-500 animate-pulse shrink-0" />
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  {remainMinutes > 0 ? `${remainMinutes}분 남음` : `${remainSeconds}초 남음`}
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  ({currentInterval} 주기)
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-60 ml-0.5" />
              </>
            ) : target.isActive ? (
              <>
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {currentInterval}마다 상시 동작
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-60 ml-0.5" />
              </>
            ) : (
              <>
                <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>
                  {currentInterval} 간격 · {target.autoStopMinutes > 0 ? `${target.autoStopMinutes}분` : '무제한'}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-60 ml-0.5" />
              </>
            )}
          </button>
        </PopoverTrigger>

        {/* 팝오버 상세 설정 (상단 잘림 방지: side=bottom, collisionPadding=16) */}
        <PopoverContent
          className="w-[330px] sm:w-[350px] p-3 space-y-2.5 max-h-[75vh] overflow-y-auto z-50 shadow-xl border-border bg-popover"
          // 왼쪽으로 펼치면 첫 번째 카드에서 사이드바에 가려진다
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={16}
          avoidCollisions={true}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1.5 font-semibold text-xs">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
              <span>수집 스케줄 & 타이머 설정</span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
              {target.name}
            </span>
          </div>

          {/* 1. 동작 중 카운트다운 박스 */}
          {isTimerActive && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  자동 정지 카운트다운
                </span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                  {remainMinutes}분 {remainSeconds.toString().padStart(2, '0')}초
                </span>
              </div>

              {/* 진행률 바 */}
              <div className="w-full bg-amber-500/20 h-1 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="text-[10px] text-muted-foreground flex justify-between">
                <span>설정: 총 {target.autoStopMinutes}분</span>
                <span>{Math.floor(elapsedMs / 60000)}분 경과</span>
              </div>

              {/* 퀵 연장 버튼 */}
              <div className="pt-1 flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] flex-1 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                  onClick={() => handleExtend(30)}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> 30분 연장
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] flex-1 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                  onClick={() => handleExtend(60)}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> 1시간 연장
                </Button>
              </div>
            </div>
          )}

          {/* 2. 섹션 1: 수집 주기 (얼마나 자주 가져올지) */}
          <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5 border border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 text-primary" />
                <Label className="text-[11px] font-semibold text-foreground">
                  1️⃣ 수집 간격 (얼마나 자주 가져올까요?)
                </Label>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                {currentInterval}마다
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {[3, 5, 10, 30].map((mins) => (
                <Button
                  key={mins}
                  variant={isFixedInterval && target.crawlIntervalMinutes === mins ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-[11px] font-medium cursor-pointer px-1"
                  onClick={() => handleSetIntervalMinutes(mins)}
                >
                  {mins}분마다
                  {isFixedInterval && target.crawlIntervalMinutes === mins && <Check className="h-2.5 w-2.5 ml-0.5" />}
                </Button>
              ))}
            </div>

            <form onSubmit={handleCustomIntervalSubmit} className="flex items-center gap-1 pt-0.5">
              <Input
                type="number"
                min="1"
                max="1440"
                placeholder="최소"
                aria-label="수집 주기 최소(분)"
                value={customIntervalMinutes}
                onChange={(e) => setCustomIntervalMinutes(e.target.value)}
                className="h-6 text-[11px] px-2"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="number"
                min="1"
                max="1440"
                placeholder="최대 (비우면 고정)"
                aria-label="수집 주기 최대(분)"
                value={customIntervalMaxMinutes}
                onChange={(e) => setCustomIntervalMaxMinutes(e.target.value)}
                className="h-6 text-[11px] px-2"
              />
              <Button type="submit" size="sm" variant="secondary" className="h-6 px-2.5 text-[11px] shrink-0 cursor-pointer">
                주기 적용
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground leading-snug">
              최대를 넣으면 매번 최소~최대 사이에서 다음 수집 시각을 무작위로 정합니다 (예: 5~10분 → 7분 뒤, 5분 뒤 …). 글이 일정한
              간격으로 올라와 자동 등록처럼 보이는 것을 줄입니다.
            </p>
          </div>

          {/* 3. 섹션 2: 동작 시간 / 타이머 (총 몇 시간 동안 켤지) */}
          <div className="space-y-1.5 rounded-lg bg-muted/40 p-2.5 border border-border/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-amber-500" />
                <Label className="text-[11px] font-semibold text-foreground">
                  2️⃣ 작동 시간 (총 몇 시간 동안 실행할까요?)
                </Label>
              </div>
              <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                {target.autoStopMinutes > 0 ? `${target.autoStopMinutes}분 후 정지` : '무제한'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-1 pt-0.5">
              {[
                { label: '30분', val: 30 },
                { label: '1시간', val: 60 },
                { label: '2시간', val: 120 },
              ].map(({ label, val }) => (
                <Button
                  key={val}
                  variant={target.autoStopMinutes === val ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-6 text-[11px] font-medium cursor-pointer px-1',
                    val === 60 && target.autoStopMinutes !== 60 && 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                  )}
                  onClick={() => handleSetTimerMinutes(val)}
                >
                  {label}
                  {target.autoStopMinutes === val && <Check className="h-2.5 w-2.5 ml-0.5" />}
                </Button>
              ))}
            </div>

            <Button
              variant={target.autoStopMinutes === 0 ? 'secondary' : 'outline'}
              size="sm"
              className="w-full h-6 text-[11px] justify-between cursor-pointer px-2"
              onClick={() => handleSetTimerMinutes(0)}
            >
              <span className="flex items-center">
                <InfinityIcon className="h-3 w-3 mr-1 text-muted-foreground" />
                무제한 상시 수집 (타이머 없이 계속 실행)
              </span>
              {target.autoStopMinutes === 0 && <Check className="h-2.5 w-2.5" />}
            </Button>

            <form onSubmit={handleCustomStopSubmit} className="flex gap-1 pt-0.5">
              <Input
                type="number"
                min="0"
                max="10080"
                placeholder="직접 입력 (예: 45, 0은 무제한)"
                value={customStopMinutes}
                onChange={(e) => setCustomStopMinutes(e.target.value)}
                className="h-6 text-[11px] px-2"
              />
              <Button type="submit" size="sm" variant="secondary" className="h-6 px-2.5 text-[11px] shrink-0 cursor-pointer">
                타이머 적용
              </Button>
            </form>
          </div>

          {/* 4. 하단 안내 */}
          <div className="pt-0.5 text-center">
            <p className="text-[10px] text-muted-foreground">
              👉 주기와 타이머를 설정하신 후, 바로 옆 <b>[시작] / [중지]</b> 버튼을 누르면 수집이 가동됩니다.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* 2. 우측 영역: 시작 / 중지 실행 버튼 (일체형으로 결합) */}
      {target.isActive ? (
        <button
          type="button"
          onClick={handleStop}
          disabled={isPending}
          className="flex items-center gap-1 px-3 py-1 text-xs text-destructive hover:bg-destructive hover:text-white transition-colors cursor-pointer font-semibold shrink-0"
          title="수집을 즉시 중지합니다"
        >
          <Square className="h-3 w-3 fill-current" />
          중지
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStart}
          disabled={isPending}
          className="flex items-center gap-1 px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer font-semibold shrink-0"
          title={
            target.autoStopMinutes > 0
              ? `${currentInterval} 주기 · ${target.autoStopMinutes}분 타이머로 수집 시작`
              : `${currentInterval} 주기 · 무제한 수집 시작`
          }
        >
          <Play className="h-3 w-3 fill-current" />
          시작
        </button>
      )}
    </div>
  );
}

/**
 * 카드 본문 배지 영역에서 실시간 남은 시간을 보여주는 배지 컴포넌트
 */
export function TargetCountdownBadge({ target }: { target: CrawlerTarget }) {
  const [now, setNow] = useState(Date.now());
  const isTimerActive = target.isActive && (target.autoStopMinutes ?? 0) > 0;

  useEffect(() => {
    if (!isTimerActive) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive]);

  if (!target.autoStopMinutes || target.autoStopMinutes <= 0) {
    return null;
  }

  // 아직 시작되지 않은(정지된) 상태일 때
  if (!target.isActive) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-muted">
        <Timer className="h-3 w-3 mr-1" />
        타이머: {target.autoStopMinutes}분 ([시작] 클릭 시 동작)
      </Badge>
    );
  }

  // 실제 타이머가 돌고 있는 상태일 때
  const activatedMs = target.activatedAt ? new Date(target.activatedAt).getTime() : now;
  const totalMs = target.autoStopMinutes * 60 * 1000;
  const elapsedMs = Math.max(0, now - activatedMs);
  const remainMs = Math.max(0, totalMs - elapsedMs);
  const remainTotalSeconds = Math.floor(remainMs / 1000);
  const remainMinutes = Math.floor(remainTotalSeconds / 60);
  const remainSeconds = remainTotalSeconds % 60;

  return (
    <Badge
      variant="outline"
      className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5 font-medium flex items-center gap-1"
    >
      <Timer className="h-3 w-3 text-amber-500 animate-pulse" />
      <span>
        {remainMinutes > 0
          ? `${remainMinutes}분 ${remainSeconds}초 후 자동종료 (총 ${target.autoStopMinutes}분)`
          : `${remainSeconds}초 후 자동종료`}
      </span>
    </Badge>
  );
}
