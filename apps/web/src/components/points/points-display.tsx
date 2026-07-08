'use client';

import { usePointsStore } from '@/lib/stores/points.store';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useEffect } from 'react';
import { Coins } from 'lucide-react';
import Link from 'next/link';

export function PointsDisplay() {
  const { user } = useAuthStore();
  const { points, fetchPoints } = usePointsStore();

  useEffect(() => {
    if (user) {
      fetchPoints();
    }
  }, [user, fetchPoints]);

  if (!user || !points) return null;

  return (
    <Link 
      href="/points"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-100/50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30 transition-colors text-sm font-medium text-yellow-700 dark:text-yellow-500"
    >
      <Coins className="w-4 h-4" />
      <span>{points.availablePoints.toLocaleString()} P</span>
    </Link>
  );
}
