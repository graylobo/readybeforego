'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function BrandLogo({ className, size = 'md', onClick }: BrandLogoProps) {
  const sizeClasses = {
    sm: 'text-sm md:text-base leading-none',
    md: 'text-base md:text-lg lg:text-xl leading-none',
    lg: 'text-xl md:text-2xl lg:text-3xl leading-none',
  };

  const dotSizes = {
    sm: 'w-[3.5px] h-[3.5px] mx-[1px]',
    md: 'w-[4.5px] h-[4.5px] mx-[1.5px]',
    lg: 'w-[5.5px] h-[5.5px] mx-[2px]',
  };

  const iconSizes = {
    sm: 'w-4 h-4 -ml-[1px]',
    md: 'w-5 h-5 -ml-[1px]',
    lg: 'w-6.5 h-6.5 -ml-[1px]',
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'inline-flex items-center font-black tracking-tighter select-none font-sans group cursor-pointer transition-all duration-300',
        sizeClasses[size],
        className
      )}
    >
      {/* READY (Desktop: READY / Mobile: R) */}
      <span className="text-foreground tracking-tighter group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
        <span className="hidden sm:inline">READY</span>
        <span className="sm:hidden">R</span>
      </span>

      {/* Trip.com Style Tight Accent Dot (Centered Vertically with Uppercase Text) */}
      <span className={cn('inline-block rounded-full bg-amber-500 shrink-0 self-center', dotSizes[size])} />

      {/* BEFORE (Desktop: BEFORE / Mobile: B) */}
      <span className="text-foreground tracking-tighter group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
        <span className="hidden sm:inline">BEFORE</span>
        <span className="sm:hidden">B</span>
      </span>

      {/* Trip.com Style Tight Accent Dot */}
      <span className={cn('inline-block rounded-full bg-amber-500 shrink-0 self-center', dotSizes[size])} />

      {/* GO + Globe Icon */}
      <span className="inline-flex items-center">
        <span className="text-foreground tracking-tighter group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
          GO
        </span>
        
      </span>
    </div>
  );
}
