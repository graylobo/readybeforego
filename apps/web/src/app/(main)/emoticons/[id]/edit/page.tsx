'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmoticonPack, useUpdateEmoticonPack } from '@/hooks/queries/use-emoticon-queries';
import { uploadsApi } from '@/lib/api/uploads';
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
import { AlertTriangle, ArrowLeft, GripVertical, Loader2, Star, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageContainer } from '@/components/layout/page-container';

const MIN_ITEMS = 5;
const MAX_ITEMS = 15;
const BASE_PRICE_PER_IMAGE = 200;

interface EmoticonItem {
  id: string;            // unique ID for dnd
  preview: string;       // local object URL or existing CDN URL
  file?: File;
  url?: string;          // uploaded CDN URL
  uploading?: boolean;
  error?: boolean;
}

function SortableEmoticonItem({ 
    item, 
    idx, 
    isThumbnail, 
    onSelectThumbnail, 
    onRemove 
}: { 
    item: EmoticonItem; 
    idx: number; 
    isThumbnail: boolean;
    onSelectThumbnail: (idx: number) => void;
    onRemove: (idx: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

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
        className="relative group touch-none"
    >
      <button
        type="button"
        onClick={() => onSelectThumbnail(idx)}
        className={cn(
          'w-full aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 bg-muted/20 flex items-center justify-center p-1',
          isThumbnail
            ? 'border-violet-500 ring-2 ring-violet-500/30 scale-[1.03]'
            : 'border-border/50 hover:border-violet-400/60 hover:scale-[1.02]'
        )}
      >
        <img src={item.preview} alt="" className="w-full h-full object-contain" />
        {item.uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
        {item.error && (
          <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center rounded-xl">
            <X className="w-5 h-5 text-destructive" />
          </div>
        )}
      </button>

      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-1 right-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-1 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-3.5 h-3.5 text-white" />
      </div>

      {isThumbnail && (
        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center shadow-lg">
          <Star className="w-3 h-3 text-white fill-white" />
        </div>
      )}
      
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(idx);
        }}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg cursor-pointer hover:scale-110 z-10"
      >
        <X className="w-3 h-3 text-white" />
      </button>

      {/* Order number */}
      <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[9px] font-bold rounded px-1">
        {idx + 1}
      </div>
    </div>
  );
}

export default function EditEmoticonPage() {
  const router = useRouter();
  const { id } = useParams();
  const { user } = useAuthStore();
  const { data: pack, isLoading: isPackLoading } = useEmoticonPack(id as string);
  const updateMutation = useUpdateEmoticonPack();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<EmoticonItem[]>([]);
  const [thumbnailIdx, setThumbnailIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((item) => item.id === active.id);
        const newIndex = prev.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(prev, oldIndex, newIndex);
        
        // update thumbnail index if needed
        if (thumbnailIdx === oldIndex) {
            setThumbnailIdx(newIndex);
        } else if (thumbnailIdx > oldIndex && thumbnailIdx <= newIndex) {
            setThumbnailIdx(thumbnailIdx - 1);
        } else if (thumbnailIdx < oldIndex && thumbnailIdx >= newIndex) {
            setThumbnailIdx(thumbnailIdx + 1);
        }

        return newItems;
      });
    }
  };

  // Initialize state when data is loaded
  useEffect(() => {
    if (pack) {
      setTitle(pack.title);
      setDescription(pack.description || '');
      
      const emoticonItems = (pack.emoticons || []).map(e => ({
        id: e.id,
        preview: e.url,
        url: e.url,
        uploading: false,
        error: false,
      }));
      setItems(emoticonItems);

      // Find thumbnail index
      const idx = emoticonItems.findIndex(it => it.url === pack.thumbnailUrl);
      setThumbnailIdx(idx !== -1 ? idx : 0);
    }
  }, [pack]);

  const estimatedPrice = items.length * BASE_PRICE_PER_IMAGE;

  const handleFilesAdded = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    setItems(prev => {
      const remaining = MAX_ITEMS - prev.length;
      if (remaining <= 0) {
        toast.error(`최대 ${MAX_ITEMS}개까지만 등록할 수 있습니다.`);
        return prev;
      }
      const toAdd = fileArray.slice(0, remaining);
      const newItems: EmoticonItem[] = toAdd.map(f => ({
        id: crypto.randomUUID(),
        preview: URL.createObjectURL(f),
        file: f,
        uploading: true,
      }));

      setTimeout(() => uploadFiles(toAdd), 0);
      return [...prev, ...newItems];
    });
  }, []);

  const uploadFiles = async (files: File[]) => {
    for (const file of files) {
      try {
        const isAnimated = file.type === 'image/gif' || file.type === 'image/webp';
        const url = await uploadsApi.uploadImage(file, { compress: !isAnimated });
        setItems(prev => {
          const idx = prev.findIndex(it => it.file === file);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], url, uploading: false, error: false };
          return updated;
        });
      } catch {
        setItems(prev => {
          const idx = prev.findIndex(it => it.file === file);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = { ...updated[idx], uploading: false, error: true };
          return updated;
        });
        toast.error(`${file.name} 업로드 실패`);
      }
    }
  };

  const removeItem = (index: number) => {
    setItems(prev => {
      const updated = [...prev];
      if (updated[index].file) {
        URL.revokeObjectURL(updated[index].preview);
      }
      updated.splice(index, 1);
      return updated;
    });
    setThumbnailIdx(prev => {
      if (index === prev) return 0;
      if (index < prev) return prev - 1;
      return prev;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  }, [handleFilesAdded]);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('이모티콘 이름을 입력해주세요.'); return; }
    if (items.length < MIN_ITEMS) { toast.error(`최소 ${MIN_ITEMS}개의 이모티콘이 필요합니다.`); return; }
    if (items.some(it => it.uploading)) { toast.error('이미지 업로드 중입니다. 잠시 후 다시 시도해주세요.'); return; }
    if (items.some(it => it.error)) { toast.error('업로드 실패한 이미지가 있습니다. 제거 후 다시 시도해주세요.'); return; }

    const thumbnailUrl = items[thumbnailIdx]?.url;
    if (!thumbnailUrl) { toast.error('썸네일 이미지가 아직 업로드 중입니다.'); return; }

    setIsSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        id: id as string,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          price: estimatedPrice,
          thumbnailUrl,
          emoticons: items.map((it, i) => ({ url: it.url!, order: i })),
        }
      });
      router.push(`/emoticons/${id}`);
    } catch {
      // error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  const allUploaded = items.length >= MIN_ITEMS && !items.some(it => it.uploading || it.error);

  if (!user) {
    return (
      <PageContainer maxWidth="sm" className="!py-16 text-center">
        <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
        <Button onClick={() => router.push('/login')}>로그인</Button>
      </PageContainer>
    );
  }

  if (isPackLoading) {
    return (
      <PageContainer maxWidth="sm" className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  if (pack && pack.authorId !== user.id) {
    return (
      <PageContainer maxWidth="sm" className="!py-16 text-center">
        <p className="text-muted-foreground mb-4">수정 권한이 없습니다.</p>
        <Button onClick={() => router.push('/emoticons')}>돌아가기</Button>
      </PageContainer>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageContainer maxWidth="sm">
        <Link href={`/emoticons/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" />
          이모티콘 상세로
        </Link>

        <h1 className="text-2xl font-black mb-2">이모티콘 수정</h1>
        <p className="text-sm text-muted-foreground mb-8">
            {pack?.status === 'approved' 
                ? '이미 승인된 상품입니다. 수정 시 다시 관리자의 검토 단계를 거치게 됩니다.'
                : '심사 후 승인되면 샵에서 판매됩니다.'}
        </p>

        {pack?.status === 'approved' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8 flex gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-semibold">승인 완료 상품 안내</p>
                    <p className="text-xs opacity-80">
                        현재 판매 중인 상품입니다. 정보 수정 시 즉시 비공개 처리되며, 새로운 심사가 완료될 때까지 상점에서 내려갑니다.
                    </p>
                </div>
            </div>
        )}

        {pack?.status === 'rejected' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 flex gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div className="text-sm text-red-700 dark:text-red-300">
                    <p className="font-semibold">반려 사유 안내</p>
                    <p className="mt-1 font-medium">{pack.rejectionReason || '사유가 입력되지 않았습니다.'}</p>
                    <p className="text-xs opacity-80 mt-2">
                        위 사유를 확인하여 수정한 후 다시 저장해 주세요. 저장 시 자동으로 재심사가 요청됩니다.
                    </p>
                </div>
            </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-foreground mb-1.5 block">
              이모티콘 이름 <span className="text-destructive">*</span>
            </label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="ex) 귀여운 고양이 이모티콘"
              className="h-11"
              maxLength={50}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground mb-1.5 block">설명 (선택)</label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="이모티콘 소개를 입력하세요"
              className="h-11"
              maxLength={200}
            />
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="bg-muted/40 border border-border/50 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-muted-foreground">이미지</span>
              <span className={cn(
                'font-black text-lg',
                items.length < MIN_ITEMS ? 'text-yellow-500' : 'text-green-500'
              )}>
                {items.length}
              </span>
              <span className="text-muted-foreground">/ {MAX_ITEMS}장</span>
            </div>
          </div>

          {items.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3 text-foreground">
                이미지 목록
                <span className="ml-2 text-xs font-normal text-muted-foreground">⭐ 클릭하면 썸네일로 지정됩니다</span>
              </p>
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  <SortableContext 
                    items={items.map(it => it.id)}
                    strategy={rectSortingStrategy}
                  >
                    {items.map((item, idx) => (
                      <SortableEmoticonItem 
                        key={item.id}
                        item={item}
                        idx={idx}
                        isThumbnail={thumbnailIdx === idx}
                        onSelectThumbnail={setThumbnailIdx}
                        onRemove={removeItem}
                      />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            </div>
          )}

          {items.length < MAX_ITEMS && (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 flex flex-col items-center gap-3',
                isDragging
                  ? 'border-violet-500/70 bg-violet-500/5 scale-[1.01]'
                  : 'border-border/50 bg-muted/10 hover:border-violet-400/40 hover:bg-muted/20'
              )}
            >
              <Upload className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm font-semibold">이미지 추가 (최대 {MAX_ITEMS}장)</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleFilesAdded(e.target.files)}
          />
        </div>

        <div className="flex justify-between items-center mt-10 pt-6 border-t border-border/50">
          <div className="text-xs text-muted-foreground">
            {items.some(it => it.uploading) && (
              <span className="flex items-center gap-1.5 text-blue-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> 업로드 중...
              </span>
            )}
            {allUploaded && !isSubmitting && (
                <span className="text-green-600">준비 완료</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>취소</Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || items.length < MIN_ITEMS || items.some(it => it.uploading || it.error)}
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 border-0 shadow-lg shadow-violet-500/30 font-bold px-8"
            >
              {isSubmitting ? '저장 중...' : '수정 완료'}
            </Button>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
