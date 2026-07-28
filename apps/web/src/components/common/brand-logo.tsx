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
          G
        </span>
        <span className="relative inline-flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn('text-sky-500 transition-transform duration-500 group-hover:rotate-12', iconSizes[size])}
          >
            {/* Globe Circle & Latitude/Longitude Lines */}
            <circle cx="12" cy="12" r="8.5" className="stroke-sky-500 fill-sky-500/10 dark:fill-sky-400/20" strokeWidth="1.8" />
            <path d="M3.5 12h17" strokeWidth="1.2" className="stroke-sky-500/70" />
            <path d="M12 3.5a14 14 0 0 1 0 17" strokeWidth="1.2" className="stroke-sky-500/70" />
            <path d="M12 3.5a14 14 0 0 0 0 17" strokeWidth="1.2" className="stroke-sky-500/70" />
            
            {/* Airplane Orbit Trail */}
            <ellipse cx="12" cy="12" rx="10" ry="4.5" className="stroke-amber-500 dark:stroke-amber-400 fill-none" strokeWidth="1.5" strokeDasharray="3 2" transform="rotate(-25 12 12)" />
            
            {/* Orbiting Airplane Icon */}
            <path
              d="M 19 6.5 L 22.5 7.5 L 21 10.5 L 22 12.5 L 20 11.5 L 19 13 L 18.5 12.5 L 19.5 10.5 L 18 9.5 Z"
              className="fill-amber-500 stroke-none transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </svg>
        </span>
      </span>
    </div>
  );
}
