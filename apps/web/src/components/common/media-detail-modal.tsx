"use client";

import { Comments } from "@/components/comments/comments";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface MediaDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  initialImageIndex?: number;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  title?: string;
  description: string;
  targetType: "scam_info" | "post";
  targetId: string;
  avoidanceTip?: string | null;
  reportType?: "CAUTION" | "TIP" | string;
  badges?: React.ReactNode;
}

export function ImageSlider({ 
  images, 
  initialIndex = 0, 
  className 
}: { 
  images: string[]; 
  initialIndex?: number; 
  className?: string 
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      containerRef.current.scrollTo({
        left: width * initialIndex,
        behavior: "instant" as ScrollBehavior,
      });
    }
  }, [initialIndex, images]);

  const scrollTo = (index: number) => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      containerRef.current.scrollTo({
        left: width * index,
        behavior: "smooth",
      });
      setCurrentIndex(index);
    }
  };

  const handleScroll = () => {
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      if (width > 0) {
        const index = Math.round(containerRef.current.scrollLeft / width);
        setCurrentIndex(index);
      }
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentIndex > 0) {
      scrollTo(currentIndex - 1);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentIndex < images.length - 1) {
      scrollTo(currentIndex + 1);
    }
  };

  if (images.length === 0) return null;

  return (
    <div className={cn("relative w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden group/slider", className)}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
        style={{ 
          scrollBehavior: "smooth",
          scrollbarWidth: "none",
          msOverflowStyle: "none"
        }}
      >
        {images.map((src, i) => (
          <div key={i} className="min-w-full h-full snap-start relative flex items-center justify-center bg-zinc-950">
            <img 
              src={src} 
              alt={`slide-${i}`} 
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && currentIndex > 0 && (
        <button 
          type="button"
          onClick={handlePrev}
          className="absolute left-3 w-8 h-8 rounded-full bg-background/80 hover:bg-background text-foreground flex items-center justify-center shadow-md transition-all z-20 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button 
          type="button"
          onClick={handleNext}
          className="absolute right-3 w-8 h-8 rounded-full bg-background/80 hover:bg-background text-foreground flex items-center justify-center shadow-md transition-all z-20 cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-30 bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md shadow-md pointer-events-auto">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollTo(i);
              }}
              className={cn(
                "rounded-full transition-all cursor-pointer",
                i === currentIndex 
                  ? "bg-white w-2 h-2 shadow-xs scale-110" 
                  : "bg-white/40 hover:bg-white/80 w-1.5 h-1.5"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MediaDetailModal({
  isOpen,
  onOpenChange,
  images,
  initialImageIndex = 0,
  authorName,
  authorAvatar = "",
  createdAt,
  title,
  description,
  targetType,
  targetId,
  avoidanceTip,
  reportType,
  badges,
}: MediaDetailModalProps) {
  const queryClient = useQueryClient();
  const hasImages = images && images.length > 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}일 전`;
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "p-0 overflow-hidden bg-background border border-border rounded-2xl flex flex-col transition-all duration-300",
          hasImages 
            ? "max-w-5xl h-[85vh] md:h-[75vh] md:flex-row gap-0" 
            : "max-w-2xl max-h-[85vh] h-auto"
        )}
      >
        <DialogTitle className="sr-only">{authorName}님의 게시물 상세</DialogTitle>
        
        {/* Left Half: Image Gallery (Only when images exist) */}
        {hasImages && (
          <div className="w-full md:w-[55%] h-[40vh] md:h-full bg-zinc-950 flex items-center justify-center relative overflow-hidden border-b md:border-b-0 md:border-r border-border shrink-0">
            <ImageSlider images={images} initialIndex={initialImageIndex} className="h-full rounded-none border-0" />
          </div>
        )}

        {/* Right Half: Content & Comments */}
        <div className={cn(
          "flex flex-col min-w-0 bg-background overflow-hidden",
          hasImages ? "w-full md:w-[45%] h-[50vh] md:h-full" : "w-full max-h-[85vh]"
        )}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
            <div className="font-bold text-sm text-foreground truncate">
              {authorName}님의 {targetType === "scam_info" ? "제보 상세" : "게시물"}
            </div>
          </div>

          {/* Scrollable Main Area (Post Body + Badges + Tip + Comments) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Author Info */}
            <div className="space-y-3 pb-3 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <Avatar className="w-9 h-9 border border-border/40 shrink-0">
                  <AvatarImage src={authorAvatar} alt={authorName} />
                  <AvatarFallback className="bg-sky-500/10 text-sky-600 font-bold text-xs">
                    {authorName.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-xs leading-tight">
                  <span className="font-bold text-sm text-foreground">{authorName}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{formatDate(createdAt)}</span>
                </div>
              </div>

              {/* Badges (Category / Scope / SubLocation) */}
              {badges && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {badges}
                </div>
              )}

              {/* Title */}
              {title && (
                <h3 className="font-bold text-base text-foreground leading-snug pt-1">{title}</h3>
              )}

              {/* Description */}
              <div className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed break-words">
                {description}
              </div>

              {/* Avoidance Tip Box (If scam_info with tip) */}
              {avoidanceTip && (
                <div className={reportType === "TIP"
                  ? "bg-emerald-50/50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800 space-y-1 dark:bg-emerald-950/10 dark:border-emerald-950/20 dark:text-emerald-300"
                  : "bg-rose-50/50 border border-rose-100 rounded-lg p-3 text-xs text-rose-800 space-y-1 dark:bg-rose-950/10 dark:border-rose-950/20 dark:text-rose-300"
                }>
                  <div className="flex items-center gap-1.5 font-bold">
                    {reportType === "TIP" ? (
                      <>
                        <Lightbulb className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>추가 팁 및 유의사항</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>대처 예방법</span>
                      </>
                    )}
                  </div>
                  <p className="leading-relaxed whitespace-pre-line pl-5">{avoidanceTip}</p>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div className="pt-1">
              <Comments 
                targetType={targetType} 
                targetId={targetId} 
                allowAnonymous={true} 
                onMutationSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: [targetType === "scam_info" ? "scams" : "posts"] });
                }}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
