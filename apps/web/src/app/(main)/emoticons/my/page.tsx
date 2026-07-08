'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useDeleteEmoticonPack,
  useMyCreatedPacks,
  useMyPurchasedPacks,
  useRestoreEmoticonPack
} from '@/hooks/queries/use-emoticon-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { ArrowLeft, Palette, Play, Plus, ShoppingBag, Trash2, Edit } from 'lucide-react';
import { SmartImage } from '@/components/common/smart-image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout/page-container';

export default function MyEmoticonsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: purchased, isLoading: isPurchasedLoading } = useMyPurchasedPacks();
  const { data: created, isLoading: isCreatedLoading } = useMyCreatedPacks();
  const deleteMutation = useDeleteEmoticonPack();
  const restoreMutation = useRestoreEmoticonPack();

  const handleStopSelling = (pack: any) => {
    if (!confirm(`"${pack.title}" 이모티콘의 판매를 중단하시겠습니까?\n이미 구매한 유저는 계속 사용할 수 있으며, 상점 목록에서만 사라집니다.`)) return;
    deleteMutation.mutate(pack.id);
  };

  const handleRestoreSelling = (pack: any) => {
    if (!confirm(`"${pack.title}" 이모티콘의 판매를 다시 시작하시겠습니까?`)) return;
    restoreMutation.mutate(pack.id);
  };

  if (!user) {
    return (
      <PageContainer maxWidth="md" className="!py-20 text-center">
        <p className="text-muted-foreground mb-4">로그인이 필요한 서비스입니다.</p>
        <Button onClick={() => router.push('/login')}>로그인하기</Button>
      </PageContainer>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageContainer maxWidth="md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/emoticons" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-3 h-3" /> 이모티콘샵
            </Link>
            <h1 className="text-2xl font-black text-foreground">내 이모티콘 관리</h1>
          </div>
          <Button asChild className="rounded-full font-bold">
            <Link href="/emoticons/create">
                <Plus className="w-4 h-4 mr-2" />
                이모티콘 등록신청
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="purchased" className="space-y-8">
          <TabsList className="bg-muted/40 p-1.5 rounded-xl border border-border/50 h-auto">
            <TabsTrigger 
                value="purchased" 
                className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-8 py-2.5 font-semibold text-sm cursor-pointer transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              구매한 이모티콘
            </TabsTrigger>
            <TabsTrigger 
                value="created" 
                className="rounded-lg gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm px-8 py-2.5 font-semibold text-sm cursor-pointer transition-all"
            >
              <Palette className="w-4 h-4" />
              제작한 이모티콘
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchased" className="space-y-4">
            {isPurchasedLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
              </div>
            ) : !purchased?.items?.length ? (
              <div className="py-20 text-center bg-muted/20 border border-dashed border-border rounded-2xl">
                <ShoppingBag className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-medium text-muted-foreground">구매한 이모티콘이 없습니다.</p>
                <Button variant="link" asChild>
                  <Link href="/emoticons">이모티콘 샵 구경하기 →</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {purchased.items.map((up: any) => {
                  const p = up.pack ?? up;
                  return (
                    <Link 
                      key={p.id} 
                      href={`/emoticons/${p.id}`}
                      className="group flex items-center gap-4 p-4 bg-card border border-border/50 rounded-2xl hover:border-primary/50 transition-all hover:shadow-md"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted/30 shrink-0 border border-border/30">
                        <SmartImage src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate group-hover:text-primary transition-colors">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            구매일: {new Date(up.purchasedAt || p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="created" className="space-y-4">
            {isCreatedLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
            ) : !created?.items?.length ? (
              <div className="py-20 text-center bg-muted/20 border border-dashed border-border rounded-2xl">
                <Palette className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="font-medium text-muted-foreground">제작한 이모티콘이 없습니다.</p>
                <Button variant="link" asChild>
                  <Link href="/emoticons/create">최초의 이모티콘 제작자가 되어보세요! →</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {created.items.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-4 p-4 bg-card border border-border/50 rounded-2xl">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted/30 shrink-0 border border-border/30">
                      <SmartImage src={p.thumbnailUrl} alt={p.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm truncate">{p.title}</p>
                        {p.deletedAt ? (
                            <Badge className="bg-muted text-muted-foreground border-transparent text-[10px] h-4">판매중지됨</Badge>
                        ) : (
                            <>
                                {p.status === 'approved' && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] h-4">승인됨</Badge>}
                                {p.status === 'pending' && <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-[10px] h-4">검토중</Badge>}
                                {p.status === 'rejected' && <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] h-4">거절됨</Badge>}
                            </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.price}P · 판매수 {p.salesCount} · 등록일 {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                        {p.status === 'approved' && !p.deletedAt && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs font-bold border-red-500/30 text-red-500 hover:bg-red-500/5 cursor-pointer"
                                onClick={() => handleStopSelling(p)}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                판매중지
                            </Button>
                        )}
                        {p.status === 'approved' && p.deletedAt && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 text-xs font-bold border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
                                onClick={() => handleRestoreSelling(p)}
                            >
                                <Play className="w-3.5 h-3.5 mr-1" />
                                판매재개
                            </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8 text-xs font-bold cursor-pointer" asChild>
                            <Link href={`/emoticons/${p.id}/edit`}>수정</Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs font-bold cursor-pointer" asChild>
                            <Link href={`/emoticons/${p.id}`}>상세보기</Link>
                        </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
}
