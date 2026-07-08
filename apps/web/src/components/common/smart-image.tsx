'use client';

import React, { useState } from 'react';
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
}

export function SmartImage({
  src,
  alt,
  className,
  onClick,
  fallbackClassName = "",
  showErrorText = true
}: SmartImageProps) {
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!src) return null;

  if (error) {
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
        src={src}
        alt={alt}
        className={cn(className, isLoading ? 'hidden' : 'block')}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setError(true);
          setIsLoading(false);
        }}
        onClick={onClick}
      />
    </>
  );
}
