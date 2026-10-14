'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { parseExcludeKeywords } from '@community/shared-types';
import { crawlerApi, CrawlerTarget, CrawlerLog, CrawlResult } from '@/lib/api/crawler';
import { boardApi } from '@/lib/api/board';
import { toast } from '@/lib/toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot,
  Play,
  Plus,
  Trash2,
  Pencil,
  ExternalLink,
  RefreshCw,
  Clock,
  Timer,
  Sparkles,
  Layers,
  AlertCircle,
  CheckCircle2,
  MessageSquarePlus,
  Eye,
  Image as ImageIcon,
  UserCheck,
  Square,
} from 'lucide-react';
import { TargetTimerControl, TargetCountdownBadge, formatCrawlInterval } from './components/target-timer-control';
import {
  TimeJitterField,
  TimeJitterValue,
  toTimeJitterPayload,
  toTimeJitterValue,
} from './components/time-jitter-field';
import { CommonPreservedTermsDialog } from './components/common-preserved-terms-dialog';
import { PreservedTermsField } from './components/preserved-terms-field';
import { OnlyNewPostsField } from './components/only-new-posts-field';
import { ExcludeKeywordsField } from './components/exclude-keywords-field';
import { CrawlDirection, CrawlDirectionField } from './components/crawl-direction-field';
import { CrawlerSettingsGuideButton, CrawlerSettingsGuidePanel } from './components/crawler-settings-guide';

function formatSkipMessage(result: CrawlResult): string {
  const skipMsg = `스킵 ${result.skipped}건`;
  if (!result.skipDetails || result.skipped === 0) return skipMsg;
  const reasons: string[] = [];
  if (result.skipDetails.alreadyCollected > 0) {
    reasons.push(`기존 수집 중복 ${result.skipDetails.alreadyCollected}건`);
  }
  if (result.skipDetails.imageFiltered > 0) {
    reasons.push(`이미지 글 제외 ${result.skipDetails.imageFiltered}건`);
  }
  if ((result.skipDetails.keywordFiltered ?? 0) > 0) {
    reasons.push(`제외 키워드 ${result.skipDetails.keywordFiltered}건`);
  }
  if (result.skipDetails.fetchFailed > 0) {
    reasons.push(`삭제/조회 실패 ${result.skipDetails.fetchFailed}건`);
  }
  if ((result.skipDetails.beforeStart ?? 0) > 0) {
    reasons.push(`켜기 전 글 제외 ${result.skipDetails.beforeStart}건`);
  }
  if ((result.skipDetails.retryExhausted ?? 0) > 0) {
    reasons.push(`실패 3회로 건너뜀 ${result.skipDetails.retryExhausted}건`);
  }
  return reasons.length > 0 ? `${skipMsg} (${reasons.join(', ')})` : skipMsg;
}

export default function AdminCrawlerPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<CrawlerTarget | null>(null);
  // 수집 설정 창의 '설정 도움말' 펼침 (등록·수정 창 공통)
  const [guideOpen, setGuideOpen] = useState(false);

  // 폼 상태 (생성용)
  const [formData, setFormData] = useState({
    name: '',
    galleryId: '',
    targetBoardId: '',
    category: '',
    minRecommendCount: 10,
    collectLimit: 5,
    promptTone: '자연스러운 커뮤니티 구어체',
    preservedTerms: '',
    excludeKeywords: '',
    // 등록 후 [시작]을 눌러야 자동 수집이 시작된다
    isActive: false,
    enableComments: true,
    commentsCount: 2,
    commentsCountMin: 0,
    commentsCountMax: 3,
    viewCountMin: 5,
    viewCountMax: 15,
    includeImages: true,
    authorMainKeywords: '',
    authorSubKeywords: '',
    authorUseSub: false,
    commentAuthorMainKeywords: '',
    commentAuthorSubKeywords: '',
    commentAuthorUseSub: false,
    onlyNewPosts: false,
    crawlDirection: 'newest' as CrawlDirection,
    pageMin: 1,
    pageMax: 3,
    crawlIntervalMinutes: 10,
    autoStopMinutes: 0,
  });

  // 폼 상태 (수정용)
  const [editFormData, setEditFormData] = useState({
    name: '',
    galleryId: '',
    targetBoardId: '',
    category: '',
    minRecommendCount: 10,
    collectLimit: 5,
    promptTone: '자연스러운 커뮤니티 구어체',
    preservedTerms: '',
    excludeKeywords: '',
    enableComments: true,
    commentsCount: 2,
    commentsCountMin: 0,
    commentsCountMax: 3,
    viewCountMin: 5,
    viewCountMax: 15,
    includeImages: true,
    authorMainKeywords: '',
    authorSubKeywords: '',
    authorUseSub: false,
    commentAuthorMainKeywords: '',
    commentAuthorSubKeywords: '',
    commentAuthorUseSub: false,
    onlyNewPosts: false,
    crawlDirection: 'newest' as CrawlDirection,
    pageMin: 1,
    pageMax: 3,
    crawlIntervalMinutes: 10,
    autoStopMinutes: 0,
  });

  // 등록 시간 분산 (실시간 토글 + 범위)
  const [createJitter, setCreateJitter] = useState<TimeJitterValue>(() => toTimeJitterValue());
  const [editJitter, setEditJitter] = useState<TimeJitterValue>(() => toTimeJitterValue());

  // 게시판 목록 조회
  const { data: boards = [] } = useQuery({
    queryKey: ['boards'],
    queryFn: () => boardApi.getBoards(),
  });

  // 수집 대상 갤러리 목록 조회
  const {
    data: targets = [],
    isLoading: isLoadingTargets,
    refetch: refetchTargets,
  } = useQuery({
    queryKey: ['crawler-targets'],
    queryFn: () => crawlerApi.getTargets(),
  });

  // 수집 로그 조회
  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['crawler-logs'],
    queryFn: () => crawlerApi.getLogs(),
  });

  // 진행 중인 수집 작업 상태 조회 (서버 기준이므로 새로고침해도 유지됨, 진행 중일 때만 폴링)
  const { data: runStatus } = useQuery({
    queryKey: ['crawler-run-status'],
    queryFn: () => crawlerApi.getRunStatus(),
    refetchInterval: (query) =>
      query.state.data?.running.length || query.state.data?.batch ? 2000 : false,
  });
  const batchJob = runStatus?.batch ?? null;

  // 직전 폴링 시점에 진행 중이던 작업. lastFinishedAt은 그 시점에 이미 있던(이전 실행의) 결과 시각으로,
  // 작업이 끝난 뒤 결과의 finishedAt이 이 값과 다를 때만 이번 실행의 결과로 보고 알림을 띄운다.
  const prevRunningRef = useRef<Map<string, { isManual: boolean; lastFinishedAt?: string }> | null>(
    null,
  );
  // 직전 폴링 시점에 진행 중이던 일괄 수집 (진행 중이 아니었으면 null)
  const prevBatchRef = useRef<{ lastFinishedAt?: string } | null>(null);

  // 진행 중이던 작업이 끝나면 결과 알림 및 목록 갱신
  useEffect(() => {
    if (!runStatus) return;
    const current = new Map(
      runStatus.running.map((job) => [
        job.targetId,
        { isManual: job.isManual, lastFinishedAt: runStatus.lastResults[job.targetId]?.finishedAt },
      ]),
    );
    const prev = prevRunningRef.current;
    prevRunningRef.current = current;

    const prevBatch = prevBatchRef.current;
    prevBatchRef.current = runStatus.batch
      ? { lastFinishedAt: prevBatch?.lastFinishedAt ?? runStatus.lastBatchResult?.finishedAt }
      : null;

    let hasFinished = false;

    const batchResult = runStatus.lastBatchResult;
    if (prevBatch && !runStatus.batch) {
      hasFinished = true;
      if (batchResult && batchResult.finishedAt !== prevBatch.lastFinishedAt) {
        if ('error' in batchResult) {
          toast.error(`일괄 수집이 실패했습니다: ${batchResult.error}`);
        } else if (batchResult.cancelled) {
          toast.warning(`일괄 수집이 중지되었습니다. (중지 전 ${batchResult.totalCollected}건 등록됨)`);
        } else {
          toast.success(
            `일괄 수집 완료: 총 ${batchResult.totalCollected}건 등록됨 (오류 ${batchResult.totalErrors}건)`,
          );
        }
      }
    }

    prev?.forEach(({ isManual, lastFinishedAt }, targetId) => {
      if (current.has(targetId)) return;
      hasFinished = true;
      const result = runStatus.lastResults[targetId];
      if (!isManual || !result || result.finishedAt === lastFinishedAt) return;
      const name = targets.find((t) => t.id === targetId)?.name ?? '';
      if ('error' in result) {
        toast.error(`"${name}" 수집이 실패했습니다: ${result.error}`);
      } else if (result.cancelled) {
        toast.warning(`"${name}" 수집이 중지되었습니다. (중지 전 ${result.collected}건 등록됨)`);
      } else if (result.baselineCaptured) {
        toast.success(`"${name}": 지금의 디시 최신 글을 기준으로 정했습니다. 다음 수집부터 새로 올라온 글을 가져옵니다.`);
      } else {
        toast.success(
          `수집 완료: ${result.collected}건 등록됨 (${formatSkipMessage(result)}, 오류 ${result.errors}건)`,
        );
      }
    });

    if (hasFinished) {
      queryClient.invalidateQueries({ queryKey: ['crawler-targets'] });
      queryClient.invalidateQueries({ queryKey: ['crawler-logs'] });
    }
  }, [runStatus, targets, queryClient]);

  // 타겟 생성 뮤테이션
  const createMutation = useMutation({
    mutationFn: crawlerApi.createTarget,
    onSuccess: () => {
      toast.success('수집 대상 갤러리가 등록되었습니다. 카드의 [시작]을 누르면 자동 수집이 시작됩니다.');
      setIsCreateOpen(false);
      setFormData({
        name: '',
        galleryId: '',
        targetBoardId: boards[0]?.id || '',
        category: '',
        minRecommendCount: 10,
        collectLimit: 5,
        promptTone: '자연스러운 커뮤니티 구어체',
        preservedTerms: '',
        excludeKeywords: '',
        isActive: false,
        enableComments: true,
        commentsCount: 2,
        commentsCountMin: 0,
        commentsCountMax: 3,
        viewCountMin: 5,
        viewCountMax: 15,
        includeImages: true,
        authorMainKeywords: '',
        authorSubKeywords: '',
        authorUseSub: false,
        commentAuthorMainKeywords: '',
        commentAuthorSubKeywords: '',
        commentAuthorUseSub: false,
        onlyNewPosts: false,
        crawlDirection: 'newest' as CrawlDirection,
        pageMin: 1,
        pageMax: 3,
        crawlIntervalMinutes: 10,
        autoStopMinutes: 0,
      });
      setCreateJitter(toTimeJitterValue());
      queryClient.invalidateQueries({ queryKey: ['crawler-targets'] });
    },
    onError: (err: any) => {
      toast.error(err.message || '등록 중 오류가 발생했습니다.');
    },
  });

  // 타겟 수정 뮤테이션
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CrawlerTarget> }) =>
      crawlerApi.updateTarget(id, data),
    onSuccess: () => {
      toast.success('수집 설정이 저장되었습니다.');
      setEditingTarget(null);
      queryClient.invalidateQueries({ queryKey: ['crawler-targets'] });
    },
    onError: (err: any) => {
      toast.error(err.message || '수정 중 오류가 발생했습니다.');
    },
  });

  const handleOpenEdit = (target: CrawlerTarget) => {
    setEditingTarget(target);
    setEditFormData({
      name: target.name,
      galleryId: target.galleryId,
      targetBoardId: target.targetBoardId,
      category: target.category || '',
      minRecommendCount: target.minRecommendCount,
      collectLimit: target.collectLimit,
      promptTone: target.promptTone || '자연스러운 커뮤니티 구어체',
      preservedTerms: target.preservedTerms || '',
      excludeKeywords: target.excludeKeywords || '',
      enableComments: target.enableComments ?? true,
      commentsCount: target.commentsCount ?? 2,
      commentsCountMin: target.commentsCountMin ?? 0,
      commentsCountMax: target.commentsCountMax ?? target.commentsCount ?? 3,
      viewCountMin: target.viewCountMin ?? 5,
      viewCountMax: target.viewCountMax ?? 15,
      includeImages: target.includeImages ?? true,
      authorMainKeywords: target.authorMainKeywords || '',
      authorSubKeywords: target.authorSubKeywords || '',
      authorUseSub: target.authorUseSub ?? false,
      commentAuthorMainKeywords: target.commentAuthorMainKeywords || '',
      commentAuthorSubKeywords: target.commentAuthorSubKeywords || '',
      commentAuthorUseSub: target.commentAuthorUseSub ?? false,
      onlyNewPosts: target.onlyNewPosts ?? false,
      crawlDirection: (target.crawlDirection === 'oldest' ? 'oldest' : 'newest') as CrawlDirection,
      pageMin: target.pageMin ?? 1,
      pageMax: target.pageMax ?? 3,
      crawlIntervalMinutes: target.crawlIntervalMinutes ?? 10,
      autoStopMinutes: target.autoStopMinutes ?? 0,
    });
    setEditJitter(toTimeJitterValue(target.timeJitterMinMinutes, target.timeJitterMaxMinutes, target.postOrderMode));
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;
    const jitter = toTimeJitterPayload(editJitter);
    if (!jitter) return;
    updateMutation.mutate({
      id: editingTarget.id,
      data: {
        ...editFormData,
        minRecommendCount: Number(editFormData.minRecommendCount),
        collectLimit: Number(editFormData.collectLimit),
        commentsCount: Number(editFormData.commentsCount),
        commentsCountMin: Number(editFormData.commentsCountMin),
        commentsCountMax: Number(editFormData.commentsCountMax),
        viewCountMin: Number(editFormData.viewCountMin),
        viewCountMax: Number(editFormData.viewCountMax),
        ...jitter,
        pageMin: Number(editFormData.pageMin),
        pageMax: Number(editFormData.pageMax),
        crawlIntervalMinutes: editingTarget.crawlIntervalMinutes ?? 10,
        autoStopMinutes: editingTarget.autoStopMinutes ?? 0,
      },
    });
  };

  // 타겟 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: crawlerApi.deleteTarget,
    onSuccess: () => {
      toast.success('수집 대상 갤러리가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['crawler-targets'] });
    },
  });

  // 개별 즉시 크롤링 트리거 (서버에서 백그라운드로 실행되고, 완료 여부는 runStatus 폴링으로 감지)
  const handleTriggerTarget = async (id: string, name: string) => {
    try {
      await crawlerApi.triggerTarget(id);
      toast.info(`"${name}" 갤러리 수집 및 LLM 리라이팅을 시작합니다...`);
      // 첫 폴링 전에 작업이 끝나더라도 완료 알림이 누락되지 않도록 진행 중으로 표시해 둔다
      if (!prevRunningRef.current) prevRunningRef.current = new Map();
      prevRunningRef.current.set(id, {
        isManual: true,
        lastFinishedAt: runStatus?.lastResults[id]?.finishedAt,
      });
      queryClient.invalidateQueries({ queryKey: ['crawler-run-status'] });
    } catch (err: any) {
      toast.error(err.message || '수집 실행 중 오류가 발생했습니다.');
      queryClient.invalidateQueries({ queryKey: ['crawler-run-status'] });
    }
  };

  // 진행 중인 수집 중지
  const handleCancelTarget = async (id: string) => {
    try {
      await crawlerApi.cancelTarget(id);
      toast.info('수집 중지를 요청했습니다. 처리 중인 게시글까지만 마무리하고 중지됩니다.');
    } catch (err: any) {
      toast.error(err.message || '수집 중지 중 오류가 발생했습니다.');
    } finally {
      queryClient.invalidateQueries({ queryKey: ['crawler-run-status'] });
    }
  };

  // 전체 즉시 크롤링 트리거 (서버에서 백그라운드로 실행되고, 완료 여부는 runStatus 폴링으로 감지)
  const handleTriggerAll = async () => {
    try {
      await crawlerApi.triggerAll();
      toast.info('모든 활성 갤러리 일괄 수집 및 리라이팅을 시작합니다...');
      // 첫 폴링 전에 작업이 끝나더라도 완료 알림이 누락되지 않도록 진행 중으로 표시해 둔다
      prevBatchRef.current = { lastFinishedAt: runStatus?.lastBatchResult?.finishedAt };
    } catch (err: any) {
      toast.error(err.message || '일괄 수집 중 오류가 발생했습니다.');
    } finally {
      queryClient.invalidateQueries({ queryKey: ['crawler-run-status'] });
    }
  };

  // 진행 중인 일괄 수집 중지
  const handleCancelAll = async () => {
    try {
      await crawlerApi.cancelAll();
      toast.info('일괄 수집 중지를 요청했습니다. 처리 중인 게시글까지만 마무리하고 중지됩니다.');
    } catch (err: any) {
      toast.error(err.message || '일괄 수집 중지 중 오류가 발생했습니다.');
    } finally {
      queryClient.invalidateQueries({ queryKey: ['crawler-run-status'] });
    }
  };

  // 로그 삭제 관련 상태
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [logToDelete, setLogToDelete] = useState<CrawlerLog | null>(null);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 단건 로그 삭제 실행
  const handleDeleteSingleLog = async () => {
    if (!logToDelete) return;
    try {
      setIsDeleting(true);
      const res = await crawlerApi.deleteLog(logToDelete.id);
      toast.success(
        `수집 이력이 삭제되었습니다. (관련 게시글, 댓글 및 호스팅 이미지 ${res.deletedImagesCount}개 삭제)`,
      );
      setLogToDelete(null);
      setSelectedLogIds((prev) => prev.filter((id) => id !== logToDelete.id));
      queryClient.invalidateQueries({ queryKey: ['crawler-logs'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['board-posts'] });
    } catch (err: any) {
      toast.error(err.message || '이력 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 선택된 로그 일괄 삭제 실행
  const handleBatchDeleteLogs = async () => {
    if (selectedLogIds.length === 0) return;
    try {
      setIsDeleting(true);
      const res = await crawlerApi.deleteLogsBatch(selectedLogIds);
      toast.success(
        `선택한 ${res.deletedLogsCount}건의 이력이 삭제되었습니다. (게시글 ${res.deletedPostsCount}개, 이미지 ${res.deletedImagesCount}개 삭제)`,
      );
      setSelectedLogIds([]);
      setIsBatchDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['crawler-logs'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['board-posts'] });
    } catch (err: any) {
      toast.error(err.message || '일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSelectAllLogs = () => {
    if (selectedLogIds.length === logs.length) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(logs.map((l) => l.id));
    }
  };

  const handleToggleSelectLog = (id: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.galleryId || !formData.targetBoardId) {
      toast.error('필수 항목을 모두 입력해주세요.');
      return;
    }
    const jitter = toTimeJitterPayload(createJitter);
    if (!jitter) return;
    createMutation.mutate({
      ...formData,
      ...jitter,
      minRecommendCount: Number(formData.minRecommendCount),
      collectLimit: Number(formData.collectLimit),
      crawlIntervalMinutes: Number(formData.crawlIntervalMinutes),
    });
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-7 w-7 text-emerald-500" />
            콘텐츠 수집 및 LLM 리라이팅 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            디시인사이드 인기 갤러리의 글을 자동 수집하고, LLM을 통해 문맥을 재구성하여 사이트 게시글로 등록합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {batchJob ? (
            <Button
              variant="destructive"
              onClick={handleCancelAll}
              disabled={batchJob.cancelRequested}
              className="cursor-pointer"
              title="진행 중인 일괄 수집을 중지합니다"
            >
              {batchJob.cancelRequested ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              {batchJob.cancelRequested
                ? '중지 중...'
                : batchJob.state === 'queued'
                  ? '일괄 수집 대기 중 (취소)'
                  : '일괄 수집 중지'}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleTriggerAll}
              disabled={targets.length === 0}
              className="cursor-pointer"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              전체 즉시 수집
            </Button>
          )}

          <CommonPreservedTermsDialog />

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="cursor-pointer">
                <Plus className="h-4 w-4 mr-2" />
                갤러리 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px] max-h-[88vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/60">
                <DialogTitle>수집 대상 갤러리 등록</DialogTitle>
                <DialogDescription>
                  디시인사이드 갤러리 ID와 우리 커뮤니티의 대상 게시판을 매핑합니다.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
                <div className="space-y-1.5">
                  <Label htmlFor="name">타겟 식별 이름 *</Label>
                  <Input
                    id="name"
                    placeholder="예: 프로그래밍 갤러리 개념글"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="galleryId">디시 갤러리 ID *</Label>
                    <Input
                      id="galleryId"
                      placeholder="예: programming"
                      value={formData.galleryId}
                      onChange={(e) =>
                        setFormData({ ...formData, galleryId: e.target.value })
                      }
                      required
                    />
                    <span className="text-[11px] text-muted-foreground">
                      gall.dcinside.com/board/lists/?id=<b>{formData.galleryId || 'xxx'}</b>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="targetBoardId">연동할 우리 게시판 *</Label>
                    <select
                      id="targetBoardId"
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={formData.targetBoardId}
                      onChange={(e) =>
                        setFormData({ ...formData, targetBoardId: e.target.value })
                      }
                      required
                    >
                      <option value="">게시판 선택</option>
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="collectLimit">1회 수집 최대 개수</Label>
                    <Input
                      id="collectLimit"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.collectLimit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          collectLimit: Number(e.target.value),
                        })
                      }
                    />
                    <span className="text-[11px] text-muted-foreground">
                      기본 1개 권장
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="minRecommend">최소 추천수 필터</Label>
                    <Input
                      id="minRecommend"
                      type="number"
                      min="0"
                      value={formData.minRecommendCount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minRecommendCount: Number(e.target.value),
                        })
                      }
                    />
                    <span className="text-[11px] text-muted-foreground">
                      0이면 전체글 탐색
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="promptTone">리라이팅 톤앤매너</Label>
                  <Input
                    id="promptTone"
                    placeholder="예: 자연스러운 커뮤니티 구어체"
                    value={formData.promptTone}
                    onChange={(e) =>
                      setFormData({ ...formData, promptTone: e.target.value })
                    }
                  />
                  <span className="text-[11px] text-muted-foreground">
                    비속어와 은어는 유지되며, 제목과 문장 배치가 자연스럽게 재작성됩니다.
                  </span>
                </div>

                <ExcludeKeywordsField
                  id="excludeKeywords"
                  value={formData.excludeKeywords}
                  onChange={(v) => setFormData({ ...formData, excludeKeywords: v })}
                />

                <PreservedTermsField
                  id="preservedTerms"
                  value={formData.preservedTerms}
                  onChange={(v) => setFormData({ ...formData, preservedTerms: v })}
                  scopeHint={<>이 카드에만 적용됩니다. 모든 카드에 쓰는 단어는 상단 <b>공통 보존 단어</b>에 적으세요.</>}
                />

                {/* 고급 옵션 */}
                <div className="border-t border-border pt-3 space-y-3">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    수집 및 가상 유저 고급 설정
                    <span className="ml-auto">
                      <CrawlerSettingsGuideButton open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} />
                    </span>
                  </h4>
                  {guideOpen && <CrawlerSettingsGuidePanel />}

                  {/* 1. 수집 페이지 범위 (최신글 기억 방지) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1 font-medium">
                        <Layers className="h-3 w-3 text-muted-foreground" /> 수집 페이지 범위 (1페이지부터 차례로)
                      </Label>
                      <span className="text-[10px] text-muted-foreground">넓히면 과거 글까지 수집</span>
                    </div>
                    <p className="text-[11px] text-primary/80 bg-primary/5 px-2 py-1 rounded border border-primary/10 leading-relaxed">
                      💡 모바일 기준 1페이지당 약 25개 글이 탐색됩니다. (PC 디시 1페이지 전체 분량을 탐색하려면 <b>1 ~ 2</b>를 입력하세요.)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="pageMin" className="text-[11px] text-muted-foreground">시작 페이지 (P)</Label>
                        <Input
                          id="pageMin"
                          type="number"
                          min="1"
                          max="50"
                          value={formData.pageMin}
                          onChange={(e) => setFormData({ ...formData, pageMin: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="pageMax" className="text-[11px] text-muted-foreground">끝 페이지 (P)</Label>
                        <Input
                          id="pageMax"
                          type="number"
                          min="1"
                          max="50"
                          value={formData.pageMax}
                          onChange={(e) => setFormData({ ...formData, pageMax: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  <CrawlDirectionField
                    value={formData.crawlDirection}
                    onChange={(crawlDirection) => setFormData({ ...formData, crawlDirection })}
                  />

                  <OnlyNewPostsField
                    checked={formData.onlyNewPosts}
                    onChange={(checked) => setFormData({ ...formData, onlyNewPosts: checked })}
                  />

                  {/* 2. 게시글 등록 시간 (실시간 또는 과거 분산) */}
                  <TimeJitterField value={createJitter} onChange={setCreateJitter} />

                  {/* 3. 조회수 범위 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="viewMin" className="text-xs flex items-center gap-1">
                        <Eye className="h-3 w-3 text-muted-foreground" /> 최소 조회수
                      </Label>
                      <Input
                        id="viewMin"
                        type="number"
                        min="0"
                        value={formData.viewCountMin}
                        onChange={(e) => setFormData({ ...formData, viewCountMin: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="viewMax" className="text-xs flex items-center gap-1">
                        <Eye className="h-3 w-3 text-muted-foreground" /> 최대 조회수
                      </Label>
                      <Input
                        id="viewMax"
                        type="number"
                        min="0"
                        value={formData.viewCountMax}
                        onChange={(e) => setFormData({ ...formData, viewCountMax: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* 2. 이미지 포함 글 수집 여부 */}
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border">
                    <div className="space-y-0.5">
                      <Label htmlFor="includeImages" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                        <ImageIcon className="h-3.5 w-3.5 text-blue-500" /> 이미지가 포함된 글 수집
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        끄면 이미지가 없는 순수 텍스트 게시글만 선별하여 수집합니다.
                      </p>
                    </div>
                    <Switch
                      id="includeImages"
                      checked={formData.includeImages}
                      onCheckedChange={(checked) => setFormData({ ...formData, includeImages: checked })}
                      className="cursor-pointer"
                    />
                  </div>

                  {/* 3. 댓글 LLM 자동 생성 */}
                  <div className="space-y-2 p-2 rounded-md bg-muted/40 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="enableComments" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                          <MessageSquarePlus className="h-3.5 w-3.5 text-emerald-500" /> 댓글 자동 달기 (LLM)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          글 발행 시 AI가 자연스러운 커뮤니티 반응 댓글을 생성해 달아줍니다.
                        </p>
                      </div>
                      <Switch
                        id="enableComments"
                        checked={formData.enableComments}
                        onCheckedChange={(checked) => setFormData({ ...formData, enableComments: checked })}
                        className="cursor-pointer"
                      />
                    </div>
                    {formData.enableComments && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground font-medium">글당 댓글 수 범위 (무작위 생성)</Label>
                          <span className="text-[10px] text-muted-foreground">최소 0개 설정 시 자연스러운 무플 글 섞임</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="cmtMin" className="text-[11px] text-muted-foreground">최소 댓글 수 (개)</Label>
                            <Input
                              id="cmtMin"
                              type="number"
                              min="0"
                              max="10"
                              value={formData.commentsCountMin}
                              onChange={(e) => setFormData({ ...formData, commentsCountMin: Number(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="cmtMax" className="text-[11px] text-muted-foreground">최대 댓글 수 (개)</Label>
                            <Input
                              id="cmtMax"
                              type="number"
                              min="0"
                              max="10"
                              value={formData.commentsCountMax}
                              onChange={(e) => setFormData({ ...formData, commentsCountMax: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. 게시글 작성자 닉네임 배합 */}
                  <div className="space-y-2 p-2 rounded-md bg-muted/40 border border-border">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-amber-500" /> 글 작성자 닉네임 조합 생성
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          비워두면 기본 가상 닉네임 풀에서 랜덤 선택됩니다.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">메인+보조 결합</span>
                        <Switch
                          checked={formData.authorUseSub}
                          onCheckedChange={(checked) => setFormData({ ...formData, authorUseSub: checked })}
                          className="cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="mainNick" className="text-[11px] text-muted-foreground">메인 키워드 (쉼표 구분)</Label>
                        <Input
                          id="mainNick"
                          placeholder="예: 가나, 다라, 마바"
                          className="h-8 text-xs"
                          value={formData.authorMainKeywords}
                          onChange={(e) => setFormData({ ...formData, authorMainKeywords: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="subNick" className="text-[11px] text-muted-foreground">보조 키워드 (쉼표 구분)</Label>
                        <Input
                          id="subNick"
                          placeholder="예: 12, 34, 56"
                          className="h-8 text-xs"
                          disabled={!formData.authorUseSub}
                          value={formData.authorSubKeywords}
                          onChange={(e) => setFormData({ ...formData, authorSubKeywords: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. 댓글 작성자 닉네임 배합 (댓글 활성화 시) */}
                  {formData.enableComments && (
                    <div className="space-y-2 p-2 rounded-md bg-muted/40 border border-border">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-medium flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> 댓글 작성자 닉네임 조합 생성
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            비워두면 AI 생성 닉네임 또는 가상 유저 풀에서 랜덤 선택됩니다.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">메인+보조 결합</span>
                          <Switch
                            checked={formData.commentAuthorUseSub}
                            onCheckedChange={(checked) => setFormData({ ...formData, commentAuthorUseSub: checked })}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="cmtMainNick" className="text-[11px] text-muted-foreground">메인 키워드 (쉼표 구분)</Label>
                          <Input
                            id="cmtMainNick"
                            placeholder="예: 댓글러, 유저, 시민"
                            className="h-8 text-xs"
                            value={formData.commentAuthorMainKeywords}
                            onChange={(e) => setFormData({ ...formData, commentAuthorMainKeywords: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="cmtSubNick" className="text-[11px] text-muted-foreground">보조 키워드 (쉼표 구분)</Label>
                          <Input
                            id="cmtSubNick"
                            placeholder="예: 01, 02, ㅋㅋ"
                            className="h-8 text-xs"
                            disabled={!formData.commentAuthorUseSub}
                            value={formData.commentAuthorSubKeywords}
                            onChange={(e) => setFormData({ ...formData, commentAuthorSubKeywords: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="px-6 py-3 border-t border-border shrink-0 bg-muted/20">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="cursor-pointer"
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="cursor-pointer"
                >
                  {createMutation.isPending ? '등록 중...' : '등록하기'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 안내 카드 */}
      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <CardContent className="py-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-2">
              타겟별 독립 주기 자동 수집 스케줄러가 활성화되어 있습니다
              <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">
                실시간 개별 스케줄링
              </Badge>
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              각 갤러리마다 <b>자동 수집 주기(예: A 5분, B 7분, C 9분)</b>를 다르게 설정하거나, <b>범위(예: 5~10분)</b>로 정해 매번 다른 간격으로 수집하여 불규칙하게 글이 등록되도록 할 수 있습니다.
              스위치가 켜진(ON) 타겟은 백엔드에서 지정된 주기마다 자동으로 크롤링 및 LLM 리라이팅을 실행합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 탭 인터페이스: 등록된 갤러리 / 수집 이력 */}
      <Tabs defaultValue="targets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="targets" className="cursor-pointer">
            <Layers className="h-4 w-4 mr-2" />
            수집 대상 갤러리 ({targets.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="cursor-pointer">
            <Clock className="h-4 w-4 mr-2" />
            수집 이력 로그 ({logs.length})
          </TabsTrigger>
        </TabsList>

        {/* 탭 1: 대상 갤러리 목록 */}
        <TabsContent value="targets" className="space-y-4">
          {isLoadingTargets ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              갤러리 목록을 불러오는 중...
            </div>
          ) : targets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground space-y-3">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <div>등록된 수집 대상 갤러리가 없습니다.</div>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1" /> 첫 번째 갤러리 등록
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {targets.map((target) => {
                const runningJob = runStatus?.running.find((job) => job.targetId === target.id);
                return (
                  <Card key={target.id} className="relative overflow-hidden">
                    <CardHeader className="p-4 pb-3">
                      {/* 1행: 타겟 제목 & 상태 배지 */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-bold flex items-center gap-1.5 truncate">
                            {target.name}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5 truncate">
                            디시 ID: <b>{target.galleryId}</b> →{' '}
                            {target.targetBoard?.name || '게시판'}
                          </CardDescription>
                        </div>
                        <div className="text-[11px] font-mono shrink-0 pt-0.5">
                          {target.isActive ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              수집 동작 중
                            </span>
                          ) : (
                            <span className="text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border/60">
                              대기 중
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 2행: 일체형 타이머 & 수집 실행 컨트롤러 */}
                      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3 text-primary" />
                          수집 타이머 제어:
                        </span>
                        <TargetTimerControl
                          target={target}
                          onUpdate={(data) =>
                            updateMutation.mutate({
                              id: target.id,
                              data,
                            })
                          }
                          isPending={updateMutation.isPending}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-3 text-xs">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 font-semibold">
                          <Clock className="h-3 w-3 mr-1" />
                          주기: {formatCrawlInterval(target)}마다
                          {!!target.crawlIntervalMaxMinutes && target.crawlIntervalMaxMinutes > target.crawlIntervalMinutes && ' (무작위)'}
                        </Badge>
                        <TargetCountdownBadge target={target} />
                        <Badge variant="secondary">
                          추천 {target.minRecommendCount}개+
                        </Badge>
                        <Badge variant="outline">
                          1회 {target.collectLimit}건
                        </Badge>
                        <Badge variant="outline" className="text-indigo-500 border-indigo-500/30">
                          페이지 {target.pageMin ?? 1}~{target.pageMax ?? 3}P
                        </Badge>
                        <Badge variant="outline" className="text-orange-500 border-orange-500/30">
                          {toTimeJitterValue(target.timeJitterMinMinutes, target.timeJitterMaxMinutes).realtime
                            ? '실시간 등록'
                            : `시간분산 ${target.timeJitterMinMinutes ?? 10}~${target.timeJitterMaxMinutes ?? 120}분 전 · ${target.postOrderMode === 'shuffled' ? '섞기' : '순서 유지'}`}
                        </Badge>
                        {target.crawlDirection === 'oldest' && (
                          <Badge variant="outline" className="text-sky-500 border-sky-500/30">
                            예전 글부터
                          </Badge>
                        )}
                        {target.onlyNewPosts && (
                          <Badge variant="outline" className="text-violet-500 border-violet-500/30">
                            켠 이후 새 글만{target.newPostsAfterId ? ` (#${target.newPostsAfterId} 이후)` : ''}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-muted-foreground">
                          조회 {target.viewCountMin ?? 10}~{target.viewCountMax ?? 30}회
                        </Badge>
                        <Badge
                          variant="outline"
                          className={target.includeImages ? 'text-blue-500 border-blue-500/30' : 'text-amber-500 border-amber-500/30'}
                        >
                          {target.includeImages ? '이미지 포함' : '텍스트 전용'}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={target.enableComments ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'}
                        >
                          {target.enableComments ? `댓글 자동(${target.commentsCountMin ?? 0}~${target.commentsCountMax ?? target.commentsCount ?? 3}개)` : '댓글 꺼짐'}
                        </Badge>
                        {!!target.excludeKeywords?.trim() && (
                          <Badge
                            variant="outline"
                            className="text-rose-500 border-rose-500/30"
                            title={`제외 키워드: ${parseExcludeKeywords(target.excludeKeywords).join(', ')}`}
                          >
                            제외 키워드 {parseExcludeKeywords(target.excludeKeywords).length}개
                          </Badge>
                        )}
                        {target.authorMainKeywords && (
                          <Badge variant="outline" className="text-purple-500 border-purple-500/30">
                            글 닉네임: {target.authorUseSub ? '메인+보조' : '메인'}
                          </Badge>
                        )}
                        {target.enableComments && target.commentAuthorMainKeywords && (
                          <Badge variant="outline" className="text-teal-500 border-teal-500/30">
                            댓글 닉네임: {target.commentAuthorUseSub ? '메인+보조' : '메인'}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 pt-1 border-t border-border/50 text-[11px]">
                        <div className="text-muted-foreground flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            마지막 수집:
                          </span>
                          <span className="font-medium text-foreground">
                            {target.lastCrawledAt
                              ? new Date(target.lastCrawledAt).toLocaleTimeString('ko-KR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '없음'}
                          </span>
                        </div>
                        {target.isActive && target.nextCrawlAt && (
                          <div className="text-muted-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              다음 수집 예정:
                            </span>
                            <span className="font-medium text-foreground">
                              {new Date(target.nextCrawlAt).toLocaleTimeString('ko-KR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}

                        {target.isActive ? (
                          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              스케줄 상태:
                            </span>
                            <span>{formatCrawlInterval(target)} 간격 자동 동작 중</span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground flex items-center justify-between">
                            <span>스케줄 상태:</span>
                            <span className="text-amber-500 font-medium">대기 중 (중지됨)</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-border">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(target)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            수정
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-8 px-2 cursor-pointer"
                            onClick={() => {
                              if (confirm(`"${target.name}" 수집 설정을 삭제하시겠습니까?`)) {
                                deleteMutation.mutate(target.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            삭제
                          </Button>
                        </div>

                        {runningJob?.isManual ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={runningJob.cancelRequested}
                            onClick={() => handleCancelTarget(target.id)}
                            className="h-8 cursor-pointer"
                            title="진행 중인 1회 수집을 중지합니다"
                          >
                            {runningJob.cancelRequested ? (
                              <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Square className="h-3.5 w-3.5 mr-1" />
                            )}
                            {runningJob.cancelRequested
                              ? '중지 중...'
                              : runningJob.state === 'queued'
                                ? '대기 중 (취소)'
                                : '수집 중지'}
                          </Button>
                        ) : target.isActive ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled
                            className="h-8 text-xs cursor-not-allowed opacity-90 border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium select-none"
                            title="현재 자동 수집 스케줄러가 활성화되어 있어 주기마다 자동으로 수집됩니다. 수동 1회 수집은 [중지] 상태에서 실행할 수 있습니다."
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                            자동 수집 중
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={!!runningJob}
                            onClick={() => handleTriggerTarget(target.id, target.name)}
                            className="h-8 cursor-pointer"
                            title="중지 상태일 때 즉시 1회 테스트 수집을 실행합니다"
                          >
                            <Play
                              className={`h-3.5 w-3.5 mr-1 ${runningJob ? 'animate-spin' : ''}`}
                            />
                            {runningJob ? '수집 중...' : '1회 즉시 수집'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 탭 2: 수집 이력 로그 */}
        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">
                  최근 수집 이력 (최대 100건)
                </CardTitle>
                <CardDescription className="text-xs">
                  디시인사이드 원본 글과 사이트에 등록된 글의 매핑 내역입니다. (이력 삭제 시 연관 게시글·댓글·이미지 일괄 정리)
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedLogIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsBatchDeleteOpen(true)}
                    className="cursor-pointer gap-1.5"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    선택 삭제 ({selectedLogIds.length}건)
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchLogs()}
                  className="cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> 새로고침
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  로그를 불러오는 중...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  아직 수집된 글이 없습니다. 갤러리를 등록하고 &apos;지금 수집&apos;을 눌러보세요.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-left">
                        <th className="pb-2 w-8 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-border cursor-pointer h-3.5 w-3.5"
                            checked={logs.length > 0 && selectedLogIds.length === logs.length}
                            onChange={handleToggleSelectAllLogs}
                          />
                        </th>
                        <th className="pb-2 font-medium">상태</th>
                        <th className="pb-2 font-medium">대상 갤러리</th>
                        <th className="pb-2 font-medium">원본 글 제목</th>
                        <th className="pb-2 font-medium">발행된 글</th>
                        <th className="pb-2 font-medium">수집 시각</th>
                        <th className="pb-2 font-medium text-right pr-2">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {logs.map((log) => {
                        const isSelected = selectedLogIds.includes(log.id);
                        return (
                          <tr
                            key={log.id}
                            className={`hover:bg-muted/30 transition-colors ${
                              isSelected ? 'bg-primary/5' : ''
                            }`}
                          >
                            <td className="py-2.5 text-center">
                              <input
                                type="checkbox"
                                className="rounded border-border cursor-pointer h-3.5 w-3.5"
                                checked={isSelected}
                                onChange={() => handleToggleSelectLog(log.id)}
                              />
                            </td>
                            <td className="py-2.5">
                              {log.status === 'SUCCESS' ? (
                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-0">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> 성공
                                </Badge>
                              ) : log.status === 'FAILED' ? (
                                <Badge variant="destructive">
                                  <AlertCircle className="h-3 w-3 mr-1" /> 실패
                                </Badge>
                              ) : (
                                <Badge variant="secondary">스킵</Badge>
                              )}
                            </td>
                            <td className="py-2.5 font-medium text-foreground">
                              {log.target?.name ?? (
                                <span className="text-muted-foreground">
                                  {log.targetName ?? '알 수 없음'} (삭제된 카드)
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 max-w-xs truncate">
                              <a
                                href={log.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-foreground hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span className="truncate">{log.originalTitle}</span>
                                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                              </a>
                            </td>
                            <td className="py-2.5 max-w-xs truncate">
                              {log.createdPost?.deletedAt ? (
                                // 지운 글은 열어도 "찾을 수 없음"이라 링크 없이 표시 (이력은 남아 같은 글을 다시 수집하지 않음)
                                <span
                                  className="inline-flex items-center gap-1.5 text-muted-foreground max-w-full"
                                  title="게시판에서 삭제한 글입니다. 이력이 남아 있어 같은 글을 다시 수집하지 않습니다."
                                >
                                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-sm bg-muted text-muted-foreground border border-border">
                                    삭제됨
                                  </span>
                                  <span className="truncate line-through">{log.createdPost.title}</span>
                                </span>
                              ) : log.createdPost ? (
                                <a
                                  href={`/board/${log.createdPost.board?.slug ?? log.createdPost.boardId}/${log.createdPost.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer max-w-full"
                                >
                                  {log.createdPost.hiddenAt && (
                                    <span
                                      className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded-sm bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                      title="비공개 처리한 글 (Super Admin만 볼 수 있음)"
                                    >
                                      비공개
                                    </span>
                                  )}
                                  <span className="truncate">{log.createdPost.title}</span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-2.5 text-muted-foreground">
                              {new Date(log.createdAt).toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-2.5 text-right pr-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                                title="이력 및 연관 글/댓글/이미지 영구 삭제"
                                onClick={() => setLogToDelete(log)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 단건 로그 삭제 확인 다이얼로그 */}
      <Dialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              수집 이력 및 연관 데이터 삭제
            </DialogTitle>
            <DialogDescription className="pt-2 text-left leading-relaxed">
              정말로 이 수집 이력을 삭제하시겠습니까?
              <br />
              <strong className="text-foreground font-semibold">
                &quot;{logToDelete?.originalTitle}&quot;
              </strong>
              <br />
              <span className="text-destructive font-medium mt-2 block">
                ⚠️ 이 작업은 생성된 게시글, 댓글은 물론 이미지 호스팅에 저장된 사진 파일까지 모두 영구 삭제합니다.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setLogToDelete(null)}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSingleLog}
              disabled={isDeleting}
              className="cursor-pointer gap-1.5"
            >
              {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              영구 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 일괄 로그 삭제 확인 다이얼로그 */}
      <Dialog open={isBatchDeleteOpen} onOpenChange={setIsBatchDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              선택한 수집 이력 일괄 삭제
            </DialogTitle>
            <DialogDescription className="pt-2 text-left leading-relaxed">
              선택하신 <strong className="text-foreground font-semibold">{selectedLogIds.length}건</strong>의 수집 이력을 모두 삭제하시겠습니까?
              <br />
              <span className="text-destructive font-medium mt-2 block">
                ⚠️ 연결된 모든 게시글, 댓글, 호스팅 이미지가 영구 삭제되며 복구할 수 없습니다.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsBatchDeleteOpen(false)}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchDeleteLogs}
              disabled={isDeleting}
              className="cursor-pointer gap-1.5"
            >
              {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {selectedLogIds.length}건 일괄 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수집 대상 수정 모달 다이얼로그 */}
      <Dialog open={!!editingTarget} onOpenChange={(open) => !open && setEditingTarget(null)}>
        <DialogContent className="sm:max-w-[540px] max-h-[88vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/60">
            <DialogTitle>수집 대상 갤러리 설정 수정</DialogTitle>
            <DialogDescription>
              디시 갤러리 매핑 및 수집 파라미터를 변경합니다.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">타겟 식별 이름 *</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-galleryId">디시 갤러리 ID *</Label>
                <Input
                  id="edit-galleryId"
                  value={editFormData.galleryId}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, galleryId: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-targetBoardId">연동할 우리 게시판 *</Label>
                <select
                  id="edit-targetBoardId"
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={editFormData.targetBoardId}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, targetBoardId: e.target.value })
                  }
                  required
                >
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-collectLimit">1회 수집 최대 개수</Label>
                <Input
                  id="edit-collectLimit"
                  type="number"
                  min="1"
                  max="20"
                  value={editFormData.collectLimit}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      collectLimit: Number(e.target.value),
                    })
                  }
                />
                <span className="text-[11px] text-muted-foreground">
                  기본 1개 권장
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-minRecommend">최소 추천수 필터</Label>
                <Input
                  id="edit-minRecommend"
                  type="number"
                  min="0"
                  value={editFormData.minRecommendCount}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      minRecommendCount: Number(e.target.value),
                    })
                  }
                />
                <span className="text-[11px] text-muted-foreground">
                  0이면 전체글 탐색
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-promptTone">리라이팅 톤앤매너</Label>
              <Input
                id="edit-promptTone"
                value={editFormData.promptTone}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, promptTone: e.target.value })
                }
              />
            </div>

            <ExcludeKeywordsField
              id="edit-excludeKeywords"
              value={editFormData.excludeKeywords}
              onChange={(v) => setEditFormData({ ...editFormData, excludeKeywords: v })}
            />

            <PreservedTermsField
              id="edit-preservedTerms"
              value={editFormData.preservedTerms}
              onChange={(v) => setEditFormData({ ...editFormData, preservedTerms: v })}
              scopeHint={<>이 카드에만 적용됩니다. 모든 카드에 쓰는 단어는 상단 <b>공통 보존 단어</b>에 적으세요.</>}
            />

            {/* 수집 및 가상 유저 고급 설정 */}
            <div className="pt-2 border-t border-border space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                수집 및 가상 유저 고급 설정
                <span className="ml-auto">
                  <CrawlerSettingsGuideButton open={guideOpen} onToggle={() => setGuideOpen((v) => !v)} />
                </span>
              </h4>
              {guideOpen && <CrawlerSettingsGuidePanel />}

              {/* 1. 수집 페이지 범위 (최신글 기억 방지) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs flex items-center gap-1 font-medium">
                    <Layers className="h-3 w-3 text-muted-foreground" /> 수집 페이지 범위 (1페이지부터 차례로)
                  </Label>
                  <span className="text-[10px] text-muted-foreground">넓히면 과거 글까지 수집</span>
                </div>
                <p className="text-[11px] text-primary/80 bg-primary/5 px-2 py-1 rounded border border-primary/10 leading-relaxed">
                  💡 모바일 기준 1페이지당 약 25개 글이 탐색됩니다. (PC 디시 1페이지 전체 분량을 탐색하려면 <b>1 ~ 2</b>를 입력하세요.)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="edit-pageMin" className="text-[11px] text-muted-foreground">시작 페이지 (P)</Label>
                    <Input
                      id="edit-pageMin"
                      type="number"
                      min="1"
                      max="50"
                      value={editFormData.pageMin}
                      onChange={(e) => setEditFormData({ ...editFormData, pageMin: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-pageMax" className="text-[11px] text-muted-foreground">끝 페이지 (P)</Label>
                    <Input
                      id="edit-pageMax"
                      type="number"
                      min="1"
                      max="50"
                      value={editFormData.pageMax}
                      onChange={(e) => setEditFormData({ ...editFormData, pageMax: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              {/* 2. 게시글 등록 시간 (실시간 또는 과거 분산) */}
              <CrawlDirectionField
                value={editFormData.crawlDirection}
                onChange={(crawlDirection) => setEditFormData({ ...editFormData, crawlDirection })}
              />

              <OnlyNewPostsField
                idPrefix="edit-"
                checked={editFormData.onlyNewPosts}
                onChange={(checked) => setEditFormData({ ...editFormData, onlyNewPosts: checked })}
                baselinePostId={editingTarget?.onlyNewPosts ? editingTarget.newPostsAfterId : null}
              />

              <TimeJitterField idPrefix="edit-" value={editJitter} onChange={setEditJitter} />

              {/* 3. 조회수 범위 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-viewMin" className="text-xs flex items-center gap-1">
                    <Eye className="h-3 w-3 text-muted-foreground" /> 최소 조회수
                  </Label>
                  <Input
                    id="edit-viewMin"
                    type="number"
                    min="0"
                    value={editFormData.viewCountMin}
                    onChange={(e) => setEditFormData({ ...editFormData, viewCountMin: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-viewMax" className="text-xs flex items-center gap-1">
                    <Eye className="h-3 w-3 text-muted-foreground" /> 최대 조회수
                  </Label>
                  <Input
                    id="edit-viewMax"
                    type="number"
                    min="0"
                    value={editFormData.viewCountMax}
                    onChange={(e) => setEditFormData({ ...editFormData, viewCountMax: Number(e.target.value) })}
                  />
                </div>
              </div>

              {/* 2. 이미지 포함 글 수집 여부 */}
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/40 border border-border">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-includeImages" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                    <ImageIcon className="h-3.5 w-3.5 text-blue-500" /> 이미지가 포함된 글 수집
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    끄면 이미지가 없는 순수 텍스트 게시글만 선별하여 수집합니다.
                  </p>
                </div>
                <Switch
                  id="edit-includeImages"
                  checked={editFormData.includeImages}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, includeImages: checked })}
                  className="cursor-pointer"
                />
              </div>

              {/* 3. 댓글 LLM 자동 생성 */}
              <div className="space-y-2 p-2 rounded-md bg-muted/40 border border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-enableComments" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                      <MessageSquarePlus className="h-3.5 w-3.5 text-emerald-500" /> 댓글 자동 달기 (LLM)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      글 발행 시 AI가 자연스러운 커뮤니티 반응 댓글을 생성해 달아줍니다.
                    </p>
                  </div>
                  <Switch
                    id="edit-enableComments"
                    checked={editFormData.enableComments}
                    onCheckedChange={(checked) => setEditFormData({ ...editFormData, enableComments: checked })}
                    className="cursor-pointer"
                  />
                </div>
                {editFormData.enableComments && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground font-medium">글당 댓글 수 범위 (무작위 생성)</Label>
                      <span className="text-[10px] text-muted-foreground">최소 0개 설정 시 자연스러운 무플 글 섞임</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="edit-cmtMin" className="text-[11px] text-muted-foreground">최소 댓글 수 (개)</Label>
                        <Input
                          id="edit-cmtMin"
                          type="number"
                          min="0"
                          max="10"
                          value={editFormData.commentsCountMin}
                          onChange={(e) => setEditFormData({ ...editFormData, commentsCountMin: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit-cmtMax" className="text-[11px] text-muted-foreground">최대 댓글 수 (개)</Label>
                        <Input
                          id="edit-cmtMax"
                          type="number"
                          min="0"
                          max="10"
                          value={editFormData.commentsCountMax}
                          onChange={(e) => setEditFormData({ ...editFormData, commentsCountMax: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. 글 작성자 닉네임 배합 */}
              <div className="space-y-2 p-2 rounded-md bg-muted/40 border border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-amber-500" /> 글 작성자 닉네임 조합 생성
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      비워두면 기본 가상 닉네임 풀에서 랜덤 선택됩니다.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">메인+보조 결합</span>
                    <Switch
                      checked={editFormData.authorUseSub}
                      onCheckedChange={(checked) => setEditFormData({ ...editFormData, authorUseSub: checked })}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="edit-mainNick" className="text-[11px] text-muted-foreground">메인 키워드 (쉼표 구분)</Label>
                    <Input
                      id="edit-mainNick"
                      placeholder="예: 가나, 다라, 마바"
                      className="h-8 text-xs"
                      value={editFormData.authorMainKeywords}
                      onChange={(e) => setEditFormData({ ...editFormData, authorMainKeywords: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-subNick" className="text-[11px] text-muted-foreground">보조 키워드 (쉼표 구분)</Label>
                    <Input
                      id="edit-subNick"
                      placeholder="예: 12, 34, 56"
                      className="h-8 text-xs"
                      disabled={!editFormData.authorUseSub}
                      value={editFormData.authorSubKeywords}
                      onChange={(e) => setEditFormData({ ...editFormData, authorSubKeywords: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 5. 댓글 작성자 닉네임 배합 (댓글 활성화 시) */}
              {editFormData.enableComments && (
                <div className="space-y-2 p-2 rounded-md bg-muted/40 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> 댓글 작성자 닉네임 조합 생성
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        비워두면 AI 생성 닉네임 또는 가상 유저 풀에서 랜덤 선택됩니다.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">메인+보조 결합</span>
                      <Switch
                        checked={editFormData.commentAuthorUseSub}
                        onCheckedChange={(checked) => setEditFormData({ ...editFormData, commentAuthorUseSub: checked })}
                        className="cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="edit-cmtMainNick" className="text-[11px] text-muted-foreground">메인 키워드 (쉼표 구분)</Label>
                      <Input
                        id="edit-cmtMainNick"
                        placeholder="예: 댓글러, 유저, 시민"
                        className="h-8 text-xs"
                        value={editFormData.commentAuthorMainKeywords}
                        onChange={(e) => setEditFormData({ ...editFormData, commentAuthorMainKeywords: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="edit-cmtSubNick" className="text-[11px] text-muted-foreground">보조 키워드 (쉼표 구분)</Label>
                      <Input
                        id="edit-cmtSubNick"
                        placeholder="예: 01, 02, ㅋㅋ"
                        className="h-8 text-xs"
                        disabled={!editFormData.commentAuthorUseSub}
                        value={editFormData.commentAuthorSubKeywords}
                        onChange={(e) => setEditFormData({ ...editFormData, commentAuthorSubKeywords: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-border shrink-0 bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingTarget(null)}
              className="cursor-pointer"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="cursor-pointer"
            >
              {updateMutation.isPending ? '저장 중...' : '변경사항 저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
    </div>
  );
}
