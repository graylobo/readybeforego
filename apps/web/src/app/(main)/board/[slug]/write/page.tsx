'use client';

import { TiptapEditor } from '@/components/editor/tiptap-editor';
import { Button } from '@/components/ui/button';
import { 
  useBoard, 
  useCreatePost 
} from '@/hooks/queries/use-board-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils/cn';
import { useNavigationLock } from '@/hooks/use-navigation-lock';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePostSchema, CreatePostDto } from '@community/shared-types';

export default function WritePage() {
    const params = useParams();
    const slug = params?.slug as string;
    const router = useRouter();
    const { user } = useAuthStore();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    
    // Board Data Fetching
    const { data: board, isLoading: boardLoading } = useBoard(slug);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors, isDirty },
    } = useForm<CreatePostDto>({
        resolver: zodResolver(CreatePostSchema),
        defaultValues: {
            boardSlug: slug,
            title: '',
            content: '',
            category: slug === 'inquiry' ? '문의' : undefined,
            guestName: !user ? (() => {
                const adj = ['즐거운', '빛나는', '신선한', '대단한', '침착한'];
                const animal = ['여우', '토끼', '사자', '부엉이', '하마'];
                return `${adj[Math.floor(Math.random() * 5)]}${animal[Math.floor(Math.random() * 5)]}${Math.floor(Math.random() * 1000)}`;
            })() : undefined,
            guestPassword: !user ? '1234' : undefined,
            allowComments: true,
            receiveCommentNotification: true,
        },
    });

    const title = watch('title');
    const content = watch('content');
    const category = watch('category');
    const guestName = watch('guestName');
    const guestPassword = watch('guestPassword');
    const allowComments = watch('allowComments') ?? true;
    const receiveCommentNotification = watch('receiveCommentNotification') ?? true;

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    // Mutation for creating post
    const createPostMutation = useCreatePost(slug);

    // Page exit prevention
    useNavigationLock(isDirty && !createPostMutation.isSuccess, '정말로 취소하시겠습니까?');

    if (boardLoading) {
        return (
          <div className="container mx-auto px-4 py-8 md:px-10">
            <div className="mb-4 h-6 w-1/4 bg-muted animate-pulse rounded" />
            <div className="mb-6 h-8 w-32 bg-muted animate-pulse rounded" />
            <div className="space-y-4">
              <div className="h-12 w-full rounded-lg bg-muted animate-pulse" />
              <div className="h-[400px] w-full rounded-lg bg-muted animate-pulse" />
            </div>
          </div>
        );
    }
    
    if (!board) {
        return (
          <div className="container mx-auto px-4 py-8 md:px-10">
            <div className="text-center py-16">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                게시판을 찾을 수 없습니다
              </h2>
              <Button onClick={() => router.push('/')}>홈으로 돌아가기</Button>
            </div>
          </div>
        );
    }
    
    const allowAnonymous = (board as any).allowAnonymous; 

    if (!user && !allowAnonymous) {
        return (
          <div className="container mx-auto px-4 py-8 md:px-10">
            <div className="text-center py-16">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                로그인이 필요합니다
              </h2>
              <p className="text-muted-foreground mb-4">
                이 게시판은 로그인한 사용자만 글을 작성할 수 있습니다.
              </p>
              <Button onClick={() => {
                  const currentUrl = encodeURIComponent(`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
                  router.push(`/login?redirect=${currentUrl}`);
              }}>로그인</Button>
            </div>
          </div>
        );
    }

    const onSubmit = (data: CreatePostDto) => {
        createPostMutation.mutate(data, {
            onSuccess: () => {
                router.push(`/board/${slug}`);
            },
            onError: () => {
                // 에러 인터셉터에서 처리됨
            }
        });
    };

    return (
        <div className="container mx-auto px-4 py-8 md:px-10">
          {/* Back Button */}
          <Link
            href={`/board/${slug}`}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{board.name}</span>
          </Link>
    
          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-6">글쓰기</h1>
    
          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!user && (
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    {...register('guestName')}
                    placeholder="닉네임"
                    className="w-full px-4 py-2 border rounded-lg bg-background text-foreground"
                    maxLength={20}
                  />
                  {errors.guestName && <p className="text-xs text-destructive mt-1">{errors.guestName.message}</p>}
                </div>
                <div className="flex-1">
                  <input
                    type="password"
                    {...register('guestPassword')}
                    placeholder="비밀번호"
                    className="w-full px-4 py-2 border rounded-lg bg-background text-foreground"
                    maxLength={20}
                  />
                  {errors.guestPassword && <p className="text-xs text-destructive mt-1">{errors.guestPassword.message}</p>}
                </div>
              </div>
            )}
            {/* Title & Category Input */}
            <div className="flex flex-col sm:flex-row gap-4">
              {slug === 'inquiry' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-12 justify-between min-w-[120px] font-normal border-2">
                        <span>{category || '카테고리'}</span>
                        <ChevronDown className="w-4 h-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[120px]">
                    <DropdownMenuItem onClick={() => setValue('category', '문의')}>문의</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setValue('category', '신고')}>신고</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setValue('category', '건의')}>건의</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <div className="flex-1">
                <input
                  type="text"
                  {...register('title')}
                  placeholder="제목을 입력하세요"
                  className="w-full px-4 py-3 text-lg border-2 rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary h-12 flex items-center"
                  maxLength={200}
                />
                {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
              </div>
            </div>
    
            {/* Admin Options */}
            {isAdmin && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('isPinned')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-foreground">고정글</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('isNotice')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-foreground">공지</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('isBest')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-foreground">베스트</span>
                </label>
              </div>
            )}

            {/* Content Editor */}
            <div>
              <TiptapEditor
                content={content}
                onChange={(val) => setValue('content', val, { shouldValidate: true, shouldDirty: true })}
                placeholder="내용을 입력하세요..."
                className="min-h-[400px]"
              />
              {errors.content && <p className="text-xs text-destructive mt-1">{errors.content.message}</p>}
            </div>

            {/* Post Options */}
            <div className="flex flex-col gap-4 p-5 border rounded-lg bg-card mt-4">
               <h3 className="text-sm font-bold text-foreground">게시글 옵션</h3>
               <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                  <div className="flex items-center gap-3">
                     <Switch
                        checked={allowComments}
                        onCheckedChange={(checked) => {
                           setValue('allowComments', checked, { shouldDirty: true });
                           if (!checked) {
                              setValue('receiveCommentNotification', false, { shouldDirty: true });
                           }
                        }}
                     />
                     <span 
                       className="text-sm font-medium text-foreground cursor-pointer select-none" 
                       onClick={() => {
                          const newValue = !allowComments;
                          setValue('allowComments', newValue, { shouldDirty: true });
                          if (!newValue) {
                             setValue('receiveCommentNotification', false, { shouldDirty: true });
                          }
                       }}
                     >
                       댓글 허용
                     </span>
                  </div>
                  {user && (
                    <div className="flex items-center gap-3 space-x-2">
                       <Switch
                          checked={receiveCommentNotification}
                          onCheckedChange={(checked) => setValue('receiveCommentNotification', checked, { shouldDirty: true })}
                          disabled={!allowComments}
                       />
                       <span 
                         className={cn(
                            "text-sm font-medium select-none", 
                            allowComments ? "text-foreground cursor-pointer" : "text-muted-foreground/50 cursor-not-allowed"
                         )} 
                         onClick={() => {
                            if (allowComments) {
                               setValue('receiveCommentNotification', !receiveCommentNotification, { shouldDirty: true });
                            }
                         }}
                       >
                         댓글 알림 받기
                       </span>
                    </div>
                  )}
               </div>
            </div>
    
            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={createPostMutation.isPending}
              >
                {createPostMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {createPostMutation.isPending ? '저장 중...' : '작성 완료'}
              </Button>
            </div>
          </form>
        </div>
      );
}
