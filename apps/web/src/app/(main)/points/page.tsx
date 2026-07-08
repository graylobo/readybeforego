'use client';

import { usePointHistory, useMyPoints } from '@/hooks/queries/use-admin-queries';
import { Coins, TrendingUp } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';

export default function PointsPage() {
  const { data: points, isLoading: pointsLoading } = useMyPoints();
  const { data: history = [], isLoading: historyLoading } = usePointHistory();

  return (
    <PageContainer maxWidth="sm" className="!p-8">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <Coins className="text-yellow-500 w-8 h-8" />
        My Points
      </h1>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="bg-card border rounded-xl p-6 shadow-sm">
           <h3 className="text-muted-foreground text-sm font-medium mb-2">Available Points</h3>
           <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">
             {points?.availablePoints.toLocaleString() || 0} P
           </div>
        </div>
        <div className="bg-card border rounded-xl p-6 shadow-sm">
           <h3 className="text-muted-foreground text-sm font-medium mb-2">Total Accumulated</h3>
           <div className="text-3xl font-bold">
             {points?.accumulatedPoints.toLocaleString() || 0} P
           </div>
           <div className="text-sm text-muted-foreground mt-1">Level {points?.level || 1}</div>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-6 border-b flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-lg">Point History</h2>
        </div>
        
        {historyLoading ? (
           <div className="p-8 text-center text-muted-foreground">Loading history...</div>
        ) : history.length > 0 ? (
           <div className="divide-y">
             {history.map((item) => (
               <div key={item.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                 <div>
                   <div className="font-medium">{item.reason}</div>
                   <div className="text-sm text-muted-foreground">
                     {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
                   </div>
                 </div>
                 <div className={`font-bold ${item.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                   {item.points > 0 ? '+' : ''}{item.points.toLocaleString()}
                 </div>
               </div>
             ))}
           </div>
        ) : (
           <div className="p-8 text-center text-muted-foreground">No point history yet.</div>
        )}
      </div>
    </PageContainer>
  );
}
