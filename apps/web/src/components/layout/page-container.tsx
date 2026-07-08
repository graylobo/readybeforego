'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { useSiteSettings } from '@/hooks/queries/use-site-queries';
import { useLayoutStore } from '@/lib/stores/layout.store';

const pageContainerVariants = cva(
  'mx-auto w-full px-4 md:px-6 py-8', // Base styles: centered, full width, padding
  {
    variants: {
      maxWidth: {
        default: 'max-w-[1200px]', // The default layout width for the entire site
        sm: 'max-w-3xl',           // For forms, creation pages
        md: 'max-w-4xl',           // For detail pages, settings
        lg: 'max-w-6xl',           // For search results, user profiles
        xl: 'max-w-7xl',
        shop: 'max-w-[1400px]',    // Wider layout for shop grids
        feed: 'max-w-[680px]',     // Narrow layout for feed posts
        full: 'max-w-full px-0 md:px-0',
      },
    },
    defaultVariants: {
      maxWidth: 'default',
    },
  }
);

interface PageContainerProps 
  extends React.HTMLAttributes<HTMLDivElement>, 
    VariantProps<typeof pageContainerVariants> {
  as?: React.ElementType;
  withAds?: boolean;
  topMaxWidth?: VariantProps<typeof pageContainerVariants>['maxWidth'];
  sidebarMaxWidth?: VariantProps<typeof pageContainerVariants>['maxWidth'];
}

export function PageContainer({ 
  className, 
  maxWidth, 
  withAds = false,
  topMaxWidth,
  sidebarMaxWidth,
  as: Component = 'div', 
  children, 
  ...props 
}: PageContainerProps) {
  const { data: settings } = useSiteSettings();
  const { layoutMode } = useLayoutStore();
  const showSidebarAds = withAds && (settings?.showSidebarAds ?? true);

  const activeMaxWidth = 
    (layoutMode === 'top' && topMaxWidth) ? topMaxWidth :
    (layoutMode === 'sidebar' && sidebarMaxWidth) ? sidebarMaxWidth :
    maxWidth;

  if (showSidebarAds) {
    return (
      <Component 
        className={cn(pageContainerVariants({ maxWidth: activeMaxWidth }), className)} 
        {...props}
      >
        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0">
            {children}
          </main>
          <aside className="hidden xl:block w-[300px] shrink-0">
            <div className="sticky top-24 bg-card border border-dashed shadow-sm rounded-2xl flex flex-col items-center justify-center p-6 text-sm text-muted-foreground font-medium h-[600px] text-center gap-2">
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-sm mb-2">AD</span>
              구글 애드센스 등<br/>광고 배너 영역<br/>(300x600 규격 기준)
            </div>
          </aside>
        </div>
      </Component>
    );
  }

  return (
    <Component 
      className={cn(pageContainerVariants({ maxWidth: activeMaxWidth }), className)} 
      {...props}
    >
      {children}
    </Component>
  );
}
