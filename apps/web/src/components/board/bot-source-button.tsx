'use client';

import React, { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { crawlerApi } from '@/lib/api/crawler';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

interface BotSourceButtonProps {
  postId: string;
  className?: string;
  showLabel?: boolean;
}

/**
 * Super Admin 전용: 봇이 등록한 게시글의 원본(디시인사이드) 글을 새 탭으로 연다.
 * 원본 주소는 일반 사용자에게 노출되지 않도록 게시글 데이터에 넣지 않고, 클릭 시 Super Admin 전용 API로 조회한다.
 * 게시글 링크(<a>) 안에서도 쓰이므로 버튼 요소 대신 span을 쓰고, 클릭이 게시글 이동으로 전파되지 않게 막는다.
 */
export function BotSourceButton({ postId, className, showLabel = true }: BotSourceButtonProps) {
  const [loading, setLoading] = useState(false);

  const openSource = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    // 응답을 기다린 뒤 window.open을 호출하면 팝업 차단에 걸리므로, 클릭 시점에 탭을 먼저 연다
    const newTab = window.open('about:blank', '_blank');
    setLoading(true);
    try {
      const { sourceUrl } = await crawlerApi.getPostSource(postId);
      if (newTab) {
        newTab.opener = null;
        newTab.location.href = sourceUrl;
      } else {
        window.open(sourceUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      newTab?.close();
      toast.error(err instanceof Error ? err.message : '원본 글 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={openSource}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') void openSource(e);
      }}
      title="Super Admin 전용: 원본 글(디시인사이드)을 새 탭으로 엽니다"
      className={cn(
        'shrink-0 px-1.5 py-0.5 text-[10px] md:text-xs font-semibold rounded-sm inline-flex items-center gap-0.5 cursor-pointer',
        'border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300',
        'hover:bg-purple-100 dark:hover:bg-purple-950/80 transition-colors',
        className,
      )}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
      {showLabel && '원본'}
    </span>
  );
}
