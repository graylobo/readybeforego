'use client';

import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const INTERVAL_PRESETS = [3, 5, 10, 30];
const STOP_PRESETS = [
  { label: '30분', val: 30 },
  { label: '1시간', val: 60 },
  { label: '2시간', val: 120 },
];

/** 작동 시간 표시: 0이면 무제한 */
function formatStopMinutes(minutes: number) {
  if (minutes <= 0) return '무제한 (타이머 없음)';
  if (minutes % 60 === 0) return `${minutes / 60}시간`;
  return minutes > 60 ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분` : `${minutes}분`;
}

/** 선택된 항목 공통 스타일 (주기·작동 시간 모두 같은 모양으로 보이게) */
const selectedOptionClass = 'border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary';

/** 숫자 인풋의 위아래 화살표를 숨겨 placeholder가 잘리지 않게 */
const numberInputClass =
  'h-6 text-[11px] px-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

export function TargetTimerControl({ target, onUpdate, isPending }: TargetTimerControlProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 팝오버에서 고른 값은 [저장] → 확인 모달을 거쳐야 반영된다
  const [draftIntervalMin, setDraftIntervalMin] = useState('');
  const [draftIntervalMax, setDraftIntervalMax] = useState('');
  const [draftStop, setDraftStop] = useState('');
  const [now, setNow] = useState(Date.now());

  const isTimerActive = target.isActive && (target.autoStopMinutes ?? 0) > 0;
  const currentInterval = formatCrawlInterval(target);
  const savedIntervalMin = target.crawlIntervalMinutes ?? 10;
  const savedIntervalMax =
    target.crawlIntervalMaxMinutes && target.crawlIntervalMaxMinutes > savedIntervalMin
      ? target.crawlIntervalMaxMinutes
      : null;
  const savedStop = target.autoStopMinutes ?? 0;

  // 타이머가 동작 중일 때만 1초마다 시간 갱신
  useEffect(() => {
    if (!isTimerActive) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive]);

  // 팝오버를 열 때마다 저장된 값으로 초안을 맞춘다 (저장 안 하고 닫으면 버려짐)
  const resetDraft = () => {
    setDraftIntervalMin(String(savedIntervalMin));
    setDraftIntervalMax(savedIntervalMax ? String(savedIntervalMax) : '');
    setDraftStop(String(savedStop));
  };

  const handleOpenChange = (next: boolean) => {
    if (next) resetDraft();
    setOpen(next);
  };

  // 남은 시간 계산
  const activatedMs = target.activatedAt ? new Date(target.activatedAt).getTime() : now;
  const totalMs = savedStop * 60 * 1000;
  const elapsedMs = Math.max(0, now - activatedMs);
  const remainMs = Math.max(0, totalMs - elapsedMs);

  const remainTotalSeconds = Math.floor(remainMs / 1000);
  const remainMinutes = Math.floor(remainTotalSeconds / 60);
  const remainSeconds = remainTotalSeconds % 60;
  const progressPercent = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0;

  // 초안 해석: 최대가 비었거나 최소 이하면 고정 주기
  const draftMin = parseInt(draftIntervalMin, 10);
  const draftMaxRaw = draftIntervalMax.trim() === '' ? null : parseInt(draftIntervalMax, 10);
  const draftMax = draftMaxRaw !== null && draftMaxRaw > draftMin ? draftMaxRaw : null;
  const draftStopVal = draftStop.trim() === '' ? NaN : parseInt(draftStop, 10);

  const isIntervalPreset = draftMax === null && INTERVAL_PRESETS.includes(draftMin);
  const isStopPreset = draftStopVal === 0 || STOP_PRESETS.some(({ val }) => val === draftStopVal);
  const isCustomInterval = !isIntervalPreset && !isNaN(draftMin) && draftMin > 0;
  const isCustomStop = !isStopPreset && !isNaN(draftStopVal) && draftStopVal > 0;

  const intervalChanged = draftMin !== savedIntervalMin || draftMax !== savedIntervalMax;
  const stopChanged = draftStopVal !== savedStop;
  const isDirty = intervalChanged || stopChanged;

  const formatDraftInterval = () => (draftMax ? `${draftMin}~${draftMax}분` : `${draftMin}분`);

  /** 저장 전 입력 확인 → 확인 모달 열기 */
  const handleSaveClick = () => {
    if (isNaN(draftMin) || draftMin < 1 || draftMin > 1440) {
      toast.error('수집 간격은 1~1440분 사이로 입력해주세요.');
      return;
    }
    if (draftMaxRaw !== null && (isNaN(draftMaxRaw) || draftMaxRaw < draftMin || draftMaxRaw > 1440)) {
      toast.error('최대는 최소 이상 1440분 이하여야 합니다 (고정 주기는 최대를 비워 두세요).');
      return;
    }
    if (isNaN(draftStopVal) || draftStopVal < 0 || draftStopVal > 10080) {
      toast.error('작동 시간은 0~10080분 사이로 입력해주세요 (0은 무제한).');
      return;
    }
    // 팝오버를 닫아야 확인 모달 클릭이 팝오버 바깥 클릭으로 잡히지 않는다
    setOpen(false);
    setConfirmOpen(true);
  };

  /** 확인 모달에서 [저장] */
  const handleConfirmSave = () => {
    const data: Partial<CrawlerTarget> = {};
    if (intervalChanged) {
      data.crawlIntervalMinutes = draftMin;
      data.crawlIntervalMaxMinutes = draftMax;
    }
    if (stopChanged) {
      data.autoStopMinutes = draftStopVal;
      // 수집 중이면 타이머를 지금부터 다시 센다
      if (target.isActive) data.activatedAt = new Date().toISOString();
    }
    onUpdate(data);
    setConfirmOpen(false);
  };

  /** 확인 모달에서 [다시 수정] — 고르던 값을 그대로 두고 팝오버로 돌아간다 */
  const handleBackToEdit = () => {
    setConfirmOpen(false);
    setOpen(true);
  };

  /**
   * 수집 시작 실행 (우측 시작 버튼)
   */
  const handleStart = () => {
    onUpdate({
      isActive: true,
      activatedAt: new Date().toISOString(),
    });
    const timerLabel = savedStop > 0 ? `${savedStop}분 타이머` : '무제한';
    toast.success(`[${target.name}] ${currentInterval} 간격 · ${timerLabel} 수집을 시작합니다. (첫 수집은 1분 안에)`);
  };

  /**
   * 수집 중지 실행 (우측 중지 버튼)
   */
  const handleStop = () => {
    onUpdate({
      isActive: false,
    });
    toast.info(`[${target.name}] 수집이 중지되었습니다.`);
  };

  /**
   * 시간 연장 (현재 동작 중일 때, 누르면 바로 반영)
   */
  const handleExtend = (extraMinutes: number) => {
    const newMinutes = Math.max(1, remainMinutes + extraMinutes);
    onUpdate({
      autoStopMinutes: newMinutes,
      activatedAt: new Date().toISOString(),
    });
    toast.success(`[${target.name}] 타이머가 ${extraMinutes}분 연장되었습니다.`);
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
      <Popover open={open} onOpenChange={handleOpenChange}>
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
                  {currentInterval} 간격 · {savedStop > 0 ? `${savedStop}분` : '무제한'}
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
                <span>설정: 총 {savedStop}분</span>
                <span>{Math.floor(elapsedMs / 60000)}분 경과</span>
              </div>

              {/* 퀵 연장 버튼 (누르면 바로 반영) */}
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
                지금 {currentInterval}마다
              </Badge>
            </div>

            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {INTERVAL_PRESETS.map((mins) => {
                const selected = isIntervalPreset && draftMin === mins;
                return (
                  <Button
                    key={mins}
                    variant="outline"
                    size="sm"
                    className={cn('h-6 text-[11px] font-medium cursor-pointer px-1', selected && selectedOptionClass)}
                    onClick={() => {
                      setDraftIntervalMin(String(mins));
                      setDraftIntervalMax('');
                    }}
                  >
                    {mins}분마다
                    {selected && <Check className="h-2.5 w-2.5 ml-0.5" />}
                  </Button>
                );
              })}
            </div>

            {/* 직접 입력: 프리셋이 아닌 값이면 이 줄이 선택된 것으로 보인다 */}
            <div
              className={cn(
                'flex items-center gap-1 rounded-md border border-transparent p-1 -mx-1',
                isCustomInterval && 'border-primary bg-primary/10'
              )}
            >
              <span
                className={cn(
                  'text-[10px] shrink-0 w-11 flex items-center gap-0.5',
                  isCustomInterval ? 'text-primary font-semibold' : 'text-muted-foreground'
                )}
              >
                {isCustomInterval && <Check className="h-2.5 w-2.5" />}
                직접
              </span>
              <Input
                type="number"
                min="1"
                max="1440"
                placeholder="최소(분)"
                aria-label="수집 주기 최소(분)"
                value={draftIntervalMin}
                onChange={(e) => setDraftIntervalMin(e.target.value)}
                className={numberInputClass}
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="number"
                min="1"
                max="1440"
                placeholder="최대(선택)"
                aria-label="수집 주기 최대(분), 비우면 고정 주기"
                value={draftIntervalMax}
                onChange={(e) => setDraftIntervalMax(e.target.value)}
                className={numberInputClass}
              />
              <span className="text-[10px] text-muted-foreground shrink-0">분</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              최대를 비우면 고정 주기, 넣으면 매번 최소~최대 사이에서 다음 수집 시각을 무작위로 정합니다 (예: 5~10분 → 7분
              뒤, 5분 뒤 …). 글이 일정한 간격으로 올라와 자동 등록처럼 보이는 것을 줄입니다.
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
                지금 {savedStop > 0 ? `${savedStop}분 후 정지` : '무제한'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-1 pt-0.5">
              {STOP_PRESETS.map(({ label, val }) => {
                const selected = draftStopVal === val;
                return (
                  <Button
                    key={val}
                    variant="outline"
                    size="sm"
                    className={cn('h-6 text-[11px] font-medium cursor-pointer px-1', selected && selectedOptionClass)}
                    onClick={() => setDraftStop(String(val))}
                  >
                    {label}
                    {selected && <Check className="h-2.5 w-2.5 ml-0.5" />}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-full h-6 text-[11px] justify-between cursor-pointer px-2',
                draftStopVal === 0 && selectedOptionClass
              )}
              onClick={() => setDraftStop('0')}
            >
              <span className="flex items-center">
                <InfinityIcon className={cn('h-3 w-3 mr-1', draftStopVal === 0 ? 'text-primary' : 'text-muted-foreground')} />
                무제한 상시 수집 (타이머 없이 계속 실행)
              </span>
              {draftStopVal === 0 && <Check className="h-2.5 w-2.5" />}
            </Button>

            <div
              className={cn(
                'flex items-center gap-1 rounded-md border border-transparent p-1 -mx-1',
                isCustomStop && 'border-primary bg-primary/10'
              )}
            >
              <span
                className={cn(
                  'text-[10px] shrink-0 w-11 flex items-center gap-0.5',
                  isCustomStop ? 'text-primary font-semibold' : 'text-muted-foreground'
                )}
              >
                {isCustomStop && <Check className="h-2.5 w-2.5" />}
                직접
              </span>
              <Input
                type="number"
                min="0"
                max="10080"
                placeholder="예: 45 (0은 무제한)"
                aria-label="작동 시간(분), 0은 무제한"
                value={draftStop}
                onChange={(e) => setDraftStop(e.target.value)}
                className={numberInputClass}
              />
              <span className="text-[10px] text-muted-foreground shrink-0">분</span>
            </div>
          </div>

          {/* 4. 저장 / 취소 */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-[11px] cursor-pointer"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button
              size="sm"
              className="h-7 flex-1 text-[11px] cursor-pointer"
              disabled={!isDirty || isPending}
              onClick={handleSaveClick}
            >
              저장
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {isDirty
              ? '바뀐 설정은 [저장]을 눌러야 반영됩니다.'
              : '👉 저장한 뒤 바로 옆 [시작] / [중지] 버튼으로 수집을 켜고 끕니다.'}
          </p>
        </PopoverContent>
      </Popover>

      {/* 저장 전 확인 모달: 바뀔 설정을 다시 보여준다 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>수집 설정을 저장할까요?</DialogTitle>
            <DialogDescription>[{target.name}] 수집 설정이 아래처럼 바뀝니다.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground shrink-0">수집 간격</span>
              <span className={cn('text-right', intervalChanged && 'font-semibold')}>
                {intervalChanged && (
                  <span className="text-muted-foreground font-normal line-through mr-1.5">{currentInterval}</span>
                )}
                {formatDraftInterval()}마다{draftMax && ' (무작위)'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground shrink-0">작동 시간</span>
              <span className={cn('text-right', stopChanged && 'font-semibold')}>
                {stopChanged && (
                  <span className="text-muted-foreground font-normal line-through mr-1.5">
                    {formatStopMinutes(savedStop)}
                  </span>
                )}
                {formatStopMinutes(draftStopVal)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {target.isActive
              ? stopChanged
                ? draftStopVal > 0
                  ? `지금 수집 중입니다. 저장하면 지금부터 ${formatStopMinutes(draftStopVal)} 뒤 자동으로 멈춥니다.`
                  : '지금 수집 중입니다. 저장하면 멈추지 않고 계속 수집합니다.'
                : '지금 수집 중입니다. 저장하면 다음 수집부터 바뀐 간격이 적용됩니다.'
              : '지금은 수집이 꺼져 있습니다. 저장한 뒤 [시작]을 눌러야 수집을 시작합니다.'}
          </p>

          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={handleBackToEdit}>
              다시 수정
            </Button>
            <Button className="cursor-pointer" disabled={isPending} onClick={handleConfirmSave}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            savedStop > 0
              ? `${currentInterval} 주기 · ${savedStop}분 타이머로 수집 시작`
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
