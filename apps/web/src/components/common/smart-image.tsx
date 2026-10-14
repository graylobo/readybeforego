'use client';

import React, { useCallback, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  fallbackClassName?: string;
  showErrorText?: boolean;
  /** src를 불러오지 못하면 대신 보여줄 주소 (예: 작은 버전이 없는 예전 이미지는 원본으로) */
  fallbackSrc?: string;
}

export function SmartImage({
  src,
  alt,
  className,
  onClick,
  fallbackClassName = "",
  showErrorText = true,
  fallbackSrc,
}: SmartImageProps) {
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  const activeSrc = [src, fallbackSrc].find((s): s is string => !!s && !failedSrcs.includes(s));
  const isLoading = loadedSrc !== activeSrc;

  const markFailed = useCallback((failed: string) => {
    setFailedSrcs((prev) => (prev.includes(failed) ? prev : [...prev, failed]));
  }, []);

  // 서버에서 그린 이미지는 화면이 반응하기(하이드레이션) 전에 다 받아져 onLoad/onError를 놓칠 수 있어, 붙는 순간 한 번 확인한다
  const checkComplete = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || !img.complete || !activeSrc) return;
      if (img.naturalWidth > 0) setLoadedSrc(activeSrc);
      // 아직 받지 않은 지연 로드(lazy) 이미지는 currentSrc가 비어 있어 실패로 보지 않는다
      else if (img.currentSrc) markFailed(activeSrc);
    },
    [activeSrc, markFailed],
  );

  if (!src) return null;

  if (!activeSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-muted/20 border border-dashed border-border rounded-xl text-muted-foreground ${className} ${fallbackClassName}`}
      >
        <ImageOff className="w-5 h-5 opacity-50" />
        {showErrorText && (
          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-50 text-center px-2">
            Image Missing
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <Skeleton className={cn("w-full h-full", className, fallbackClassName)} />
      )}
      <img
        key={activeSrc}
        ref={checkComplete}
        src={activeSrc}
        alt={alt}
        className={cn(className, isLoading ? 'hidden' : 'block')}
        onLoad={() => setLoadedSrc(activeSrc)}
        onError={() => markFailed(activeSrc)}
        onClick={onClick}
      />
    </>
  );
}
