'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';

interface OgData {
  url: string;
  domain: string;
  title: string;
  description?: string;
  image?: string;
}

export function useOgPreview(url: string) {
  return useQuery<OgData>({
    queryKey: ['og-preview', url],
    queryFn: async () => {
      const res = await fetch(`/api/og-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        throw new Error('Failed to fetch link preview');
      }
      return res.json();
    },
    enabled: Boolean(url),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
  });
}

interface ChatLinkPreviewProps {
  url: string;
  className?: string;
}

export function ChatLinkPreview({ url, className }: ChatLinkPreviewProps) {
  const { data, isLoading, isError } = useOgPreview(url);
  const [imgError, setImgError] = useState(false);

  let fallbackDomain = url;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    fallbackDomain = parsed.hostname;
  } catch {}

  if (isLoading) {
    return (
      <div
        className={cn(
          'my-2 rounded-xl border border-border/70 bg-card/60 p-3 flex gap-3 items-center',
          className,
        )}
      >
        <Skeleton className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2 min-w-0">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    );
  }

  const previewData = isError || !data ? {
    url,
    domain: fallbackDomain,
    title: fallbackDomain,
    description: '',
    image: `https://www.google.com/s2/favicons?domain=${fallbackDomain}&sz=128`,
  } : data;

  const targetUrl = previewData.url || url;

  return (
    <a
      href={targetUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'my-2 flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 p-3',
        'hover:bg-card/95 hover:border-border transition-all group cursor-pointer overflow-hidden text-left shadow-sm',
        className,
      )}
    >
      <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-xl overflow-hidden bg-muted flex items-center justify-center border border-border/40">
        {previewData.image && !imgError ? (
          <img
            src={previewData.image}
            alt={previewData.title || previewData.domain}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-emerald-600/20 text-emerald-500 flex items-center justify-center font-bold">
            <Globe className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono truncate">
          <span className="truncate">{previewData.domain}</span>
          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-0.5" />
        </div>
        <h4 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors mt-0.5 leading-snug">
          {previewData.title || previewData.domain}
        </h4>
        {previewData.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
            {previewData.description}
          </p>
        )}
      </div>
    </a>
  );
}
