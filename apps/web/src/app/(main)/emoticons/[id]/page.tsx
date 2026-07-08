'use client';

import { SmartImage } from '@/components/common/smart-image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteEmoticonPack, useEmoticonPack, useMyPurchasedPacks, usePurchaseEmoticonPack, useRestoreEmoticonPack, useUpdateEmoticonPack } from '@/hooks/queries/use-emoticon-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, ArrowLeft, CheckCircle, Edit, GripVertical, Loader2, Play, Save, ShoppingBag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PageContainer } from '@/components/layout/page-container';

function SortableEmoticonItem({ 
    emoticon, 
    isOwner 
}: { 
    emoticon: any; 
    isOwner: boolean 
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: emoticon.id, disabled: !isOwner });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group touch-none w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-border/50 bg-muted/30 hover:border-primary/40 transition-all duration-200",
                isOwner && "cursor-default"
            )}
        >
            <SmartImage src={emoticon.url} alt={emoticon.name ?? ''} className="w-full h-full object-contain" />
            
            {isOwner && (
                <div 
                    {...attributes} 
                    {...listeners}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-1 cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="w-3 h-3 text-white" />
                </div>
            )}
        </div>
    );
}



export default function EmoticonPackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: pack, isLoading } = useEmoticonPack(id);
  const { data: myPurchased } = useMyPurchasedPacks();
  const purchaseMutation = usePurchaseEmoticonPack();
  const deleteMutation = useDeleteEmoticonPack();
  const restoreMutation = useRestoreEmoticonPack();
  const updateMutation = useUpdateEmoticonPack();

  const [localEmoticons, setLocalEmoticons] = useState<any[]>([]);
  const [isOrderChanged, setIsOrderChanged] = useState(false);

  useEffect(() => {
    if (pack?.emoticons) {
      setLocalEmoticons(pack.emoticons);
      setIsOrderChanged(false);
    }
  }, [pack]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalEmoticons((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newList = arrayMove(items, oldIndex, newIndex);
        setIsOrderChanged(true);
        return newList;
      });
    }
  };

  const handleSaveOrder = async () => {
    if (!pack) return;
    try {
      await updateMutation.mutateAsync({
        id: pack.id,
        data: {
          title: pack.title,
          description: pack.description || undefined,
          price: pack.price,
          thumbnailUrl: pack.thumbnailUrl,
          emoticons: localEmoticons.map((e, idx) => ({
            url: e.url,
            order: idx,
          })),
        }
      });
      setIsOrderChanged(false);
      toast.success('이모티콘 순서가 저장되었습니다.');
    } catch {
      toast.error('순서 저장 중 오류가 발생했습니다.');
    }
  };

  const alreadyPurchased = myPurchased?.items?.some((up: any) => up.packId === id || up.pack?.id === id);
  const isOwner = user && pack && user.id === pack.authorId;
  const isDeleted = pack && (pack as any).deletedAt;

  if (isLoading) {
    return (
      <PageContainer maxWidth="md" className="!py-10 space-y-6">
        <Skeleton className="h-6 w-32" />
        <div className="flex gap-6">
          <Skeleton className="w-48 h-48 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </PageContainer>
    );
  }

  if (!pack) {
    return (
      <PageContainer maxWidth="md" className="!py-16 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold">이모티콘 팩을 찾을 수 없습니다.</h2>
        <Button onClick={() => router.back()} className="mt-4">돌아가기</Button>
      </PageContainer>
    );
  }

  const handlePurchase = () => {
    if (!user) {
      router.push(`/login?redirect=/emoticons/${id}`);
      return;
    }
    if (!window.confirm(`"${pack.title}" 이모티콘을 구매하시겠습니까?`)) return;
    purchaseMutation.mutate(id);
  };

  const handleStopSelling = () => {
    if (!confirm(`"${pack.title}" 이모티콘의 판매를 중단하시겠습니까?\n이미 구매한 유저는 계속 사용할 수 있으며, 상점 목록에서만 사라집니다.`)) return;
    deleteMutation.mutate(id as string, {
        onSuccess: () => router.refresh()
    });
  };

  const handleRestoreSelling = () => {
    if (!confirm(`"${pack.title}" 이모티콘의 판매를 다시 시작하시겠습니까?`)) return;
    restoreMutation.mutate(id as string, {
        onSuccess: () => router.refresh()
    });
  };

  const emoticons = pack.emoticons ?? [];

  return (
    <div className="min-h-screen bg-background">
      <PageContainer maxWidth="md">
        {/* Back */}
        <Link href="/emoticons" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          이모티콘샵
        </Link>

        {/* Header info */}
        <div className="flex flex-col sm:flex-row gap-6 mb-8 p-6 bg-card border border-border/50 rounded-2xl shadow-sm">
          <div className="shrink-0">
            {pack.thumbnailUrl ? (
              <SmartImage
                src={pack.thumbnailUrl}
                alt={pack.title}
                className="w-40 h-40 object-cover rounded-xl shadow-lg border border-border/30"
              />
            ) : (
              <div className="w-40 h-40 bg-muted rounded-xl flex items-center justify-center text-5xl">🎭</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-0">이모티콘</Badge>
              {isDeleted && (
                  <Badge variant="outline" className="border-red-500 text-red-500 bg-red-500/5">판매중지됨</Badge>
              )}
            </div>
            <h1 className="text-2xl font-black text-foreground mb-2">{pack.title}</h1>
            <p className="text-sm text-muted-foreground mb-1">
              <span className="font-semibold text-foreground text-base">
                {pack.price === 0 ? '무료' : `${pack.price.toLocaleString()}P`}
              </span>
              {pack.price === 0 && <> · 무제한</>}
              {' · '}
              제작: <span className="font-medium text-foreground">{(pack.author as any)?.name}</span>
              {' · '}
              {`이모티콘 개수: ${emoticons.length}`}개
            </p>
            {pack.description && (
              <p className="text-sm text-muted-foreground mt-2">{`이모티콘 설명: ${pack.description}`}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {alreadyPurchased || isOwner ? (
                <div className="flex gap-2">
                    <Button
                    disabled
                    variant="outline"
                    className="rounded-full gap-2 font-bold border-green-500 text-green-600 opacity-100"
                    >
                    <CheckCircle className="w-4 h-4" />
                    {isOwner ? '내가 만든 팩' : '구매 완료'}
                    </Button>
                    
                    {isOwner && (
                        <div className="flex gap-2">
                             <Button
                                asChild
                                variant="outline"
                                className="rounded-full gap-2 font-bold cursor-pointer"
                            >
                                <Link href={`/emoticons/${id}/edit`}>
                                    <Edit className="w-4 h-4" />
                                    수정하기
                                </Link>
                            </Button>

                            {pack.status === 'approved' && (
                                isDeleted ? (
                                    <Button
                                        onClick={handleRestoreSelling}
                                        disabled={restoreMutation.isPending}
                                        variant="outline"
                                        className="rounded-full gap-2 font-bold border-primary text-primary hover:bg-primary/5 cursor-pointer"
                                    >
                                        <Play className="w-4 h-4 fill-current" />
                                        판매재개
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={handleStopSelling}
                                        disabled={deleteMutation.isPending}
                                        variant="outline"
                                        className="rounded-full gap-2 font-bold border-red-500 text-red-500 hover:bg-red-500/5 cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        판매중단
                                    </Button>
                                )
                            )}
                        </div>
                    )}
                </div>
              ) : (
                <Button
                  onClick={handlePurchase}
                  disabled={purchaseMutation.isPending || isDeleted}
                  className="rounded-full gap-2 font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 border-0 shadow-lg shadow-violet-500/30"
                >
                  {purchaseMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingBag className="w-4 h-4" />
                  )}
                  {isDeleted ? '판매가 중단된 상품입니다' : (pack.price === 0 ? '무료로 받기' : '구매하기')}
                </Button>
              )}
              <Button variant="outline" className="rounded-full font-bold cursor-pointer" onClick={() => router.push(`/emoticons/${id}/review`)}>
                선물하기
              </Button>
            </div>
          </div>
        </div>

        <hr className="border-border/50 mb-8" />

        {/* Usage Info */}
        <div className="mb-8">
          <h2 className="text-base font-bold mb-3 text-foreground font-bold">사용범위</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>— 이모티콘은 이 사이트에서 개인적인 용도로 사용하실 수 있습니다.</li>
            <li>— 상업적인 용도로 무단 사용을 하시게 될 경우 저작권법에 따라 법적 책임을 질 수 있습니다.</li>
          </ul>
        </div>

        {/* Emoticon Grid */}
        <div className="flex flex-col items-center gap-6">
            {isOrderChanged && (
                <div className="w-full flex justify-end">
                    <Button 
                        onClick={handleSaveOrder} 
                        disabled={updateMutation.isPending}
                        className="gap-2 bg-green-600 hover:bg-green-700 font-bold"
                    >
                        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        변경된 순서 저장하기
                    </Button>
                </div>
            )}
            
            {localEmoticons.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <div className="flex flex-wrap gap-3 justify-center">
                        <SortableContext
                            items={localEmoticons.map(e => e.id)}
                            strategy={rectSortingStrategy}
                        >
                            {localEmoticons.map((emoticon) => (
                                <SortableEmoticonItem 
                                    key={emoticon.id} 
                                    emoticon={emoticon} 
                                    isOwner={isOwner || false} 
                                />
                            ))}
                        </SortableContext>
                    </div>
                </DndContext>
            )}
        </div>
      </PageContainer>
    </div>
  );
}
