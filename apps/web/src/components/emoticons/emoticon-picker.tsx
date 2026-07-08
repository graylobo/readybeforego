'use client';

import { useState, useRef, useEffect } from 'react';
import { SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SmartImage } from '@/components/common/smart-image';
import { useMyAvailableEmoticonPacks } from '@/hooks/queries/use-emoticon-queries';
import { cn } from '@/lib/utils';

interface EmoticonPickerProps {
  onSelect: (url: string) => void;
  disabled?: boolean;
  className?: string;
}

export function EmoticonPicker({ onSelect, disabled, className }: EmoticonPickerProps) {
  const [open, setOpen] = useState(false);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { packs: purchasedPacks, isLoading } = useMyAvailableEmoticonPacks();

  // Flatten pack -> emoticons from available packs
  const availablePacks = purchasedPacks;

  const activePack = activePackId
    ? availablePacks.find((p: any) => p.id === activePackId)
    : availablePacks[0];

  // Auto-select first pack
  useEffect(() => {
    if (!activePackId && availablePacks.length > 0) {
      setActivePackId(availablePacks[0].id);
    }
  }, [availablePacks.length]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (url: string) => {
    onSelect(url);
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-primary',
          open && 'text-primary bg-primary/10'
        )}
        onClick={() => setOpen(v => !v)}
        disabled={disabled}
        title="이모티콘"
      >
        <SmilePlus className="w-4 h-4" />
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="absolute bottom-10 left-0 z-50 w-[320px] bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Pack tabs */}
          {availablePacks.length > 1 && (
            <div className="flex overflow-x-auto gap-1 p-2 border-b border-border/40 bg-muted/30 scrollbar-thin">
              {availablePacks.map((pack: any) => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActivePackId(pack.id);
                  }}
                  className={cn(
                    'shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer',
                    activePackId === pack.id ? 'border-primary scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                  )}
                  title={pack.title}
                >
                  <SmartImage src={pack.thumbnailUrl} alt={pack.title} className="w-full h-full object-cover" showErrorText={false} />
                </button>
              ))}
            </div>
          )}

          {/* Emoticon grid */}
          <div className="p-2 h-[200px] overflow-y-auto">
            {isLoading ? (
              <div className="grid grid-cols-5 gap-2 p-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : availablePacks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 px-4">
                <span className="text-3xl">🛍</span>
                <p className="text-xs font-medium">보유한 이모티콘이 없습니다</p>
                <a href="/emoticons" className="text-[11px] text-primary underline underline-offset-2">
                  이모티콘샵 바로가기 →
                </a>
              </div>
            ) : !activePack?.emoticons?.length ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                이모티콘이 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {activePack.emoticons.map((item: any) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      handleSelect(item.url);
                    }}
                    className="aspect-square rounded-lg overflow-hidden hover:bg-muted/60 hover:scale-110 transition-all p-0.5 cursor-pointer"
                    title={item.name ?? ''}
                  >
                    <SmartImage src={item.url} alt={item.name ?? ''} className="w-full h-full object-contain" showErrorText={false} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
