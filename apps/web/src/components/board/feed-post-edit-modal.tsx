'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUpdatePost, Post } from '@/hooks/queries/use-board-queries';
import { useAuthStore } from '@/lib/stores/auth.store';
import { uploadsApi } from '@/lib/api/uploads';
import { toast } from '@/lib/toast';
import { 
  Image as ImageIcon, 
  X, 
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface FeedPostEditModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  boardSlug: string;
  post: Post | null;
}

export function FeedPostEditModal({
  isOpen,
  onOpenChange,
  boardSlug,
  post,
}: FeedPostEditModalProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [content, setContent] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    completed: 0,
    total: 0,
    progress: 0,
  });

  // Guest credentials (for non-login edits)
  const [guestName, setGuestName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');

  const updatePostMutation = useUpdatePost(boardSlug, post?.id || '');

  const MAX_CHAR_COUNT = 2000;

  // Initialize and parse content from existing post
  useEffect(() => {
    if (isOpen && post) {
      const imgRegex = /<img[^>]+src="([^">]+)"[^>]*>/g;
      const images: string[] = [];
      let match;
      
      // Extract images from html content
      while ((match = imgRegex.exec(post.content)) !== null) {
        images.push(match[1]);
      }
      
      // Extract text content excluding image html tags
      const textOnly = post.content.replace(imgRegex, '').trim();
      
      setContent(textOnly);
      setUploadedImages(images);
      setGuestName(post.guestName || '');
      setGuestPassword('');
    }
  }, [isOpen, post]);

  // File Upload Logic
  const handleImagesUpload = useCallback(async (files: FileList | File[]) => {
    if (uploadState.isUploading) return;

    const imageFiles = Array.from(files).filter(file =>
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
    );

    if (imageFiles.length === 0) return;

    if (uploadedImages.length + imageFiles.length > 10) {
      toast.error('이미지는 최대 10개까지 첨부할 수 있습니다.');
      return;
    }

    setUploadState({
      isUploading: true,
      completed: 0,
      total: imageFiles.length,
      progress: 0,
    });

    let completed = 0;
    const total = imageFiles.length;

    try {
      const urls: string[] = [];
      for (const file of imageFiles) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: 10MB를 초과하는 파일은 업로드할 수 없습니다.`);
          completed++;
          continue;
        }

        try {
          const url = await uploadsApi.uploadImage(file, {
            compress: true,
            onProgress: (progress: number) => {
              const currentGlobalProgress = Math.round((completed / total) * 100 + (progress / total));
              setUploadState(prev => ({
                ...prev,
                progress: currentGlobalProgress,
              }));
            }
          });
          urls.push(url);
          completed++;
          setUploadState(prev => ({
            ...prev,
            completed,
            progress: Math.round((completed / total) * 100),
          }));
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
          toast.error(`${file.name} 업로드에 실패했습니다.`);
          completed++;
        }
      }

      if (urls.length > 0) {
        setUploadedImages(prev => [...prev, ...urls]);
        toast.success(`${urls.length}개의 이미지가 추가되었습니다.`);
      }
    } finally {
      setUploadState(prev => ({ ...prev, isUploading: false, progress: 0 }));
    }
  }, [uploadState.isUploading, uploadedImages.length]);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImagesUpload(files);
    }
    e.target.value = '';
  };

  // Paste Image Support
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      await handleImagesUpload(files);
    }
  };

  const removeImage = (indexToRemove: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedText = content.trim();
    if (!trimmedText && uploadedImages.length === 0) {
      toast.error('내용을 입력해주세요.');
      return;
    }

    // Title generation from the first line or first 40 chars
    const title = trimmedText.split('\n')[0]?.trim().slice(0, 40) || '이미지 게시글';

    // Content formatting
    let finalContent = trimmedText;
    if (uploadedImages.length > 0) {
      finalContent += '\n' + uploadedImages.map(url => `<img src="${url}" />`).join('\n');
    }

    const payload = {
      title,
      content: finalContent,
      guestPassword: !user && post?.guestName ? guestPassword : undefined,
    };

    updatePostMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('글이 성공적으로 수정되었습니다.');
        
        // Refresh page post query keys
        queryClient.invalidateQueries({ queryKey: ['board-posts', boardSlug] });
        queryClient.invalidateQueries({ queryKey: ['posts', boardSlug] });
        queryClient.invalidateQueries({ queryKey: ['boards', 'posts'] });

        onOpenChange(false);
      },
      onError: (err: any) => {
        toast.error(err?.message || '글 수정에 실패했습니다.');
      }
    });
  };

  const handleClose = () => {
    // Clear states
    setContent('');
    setUploadedImages([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-2xl bg-card border border-border p-0 gap-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-bold text-foreground">글 수정하기</DialogTitle>
        </DialogHeader>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 w-full min-w-0 overflow-hidden">
          {/* User Meta Row */}
          {user ? (
            <div className="text-sm font-semibold text-muted-foreground">
              <span className="text-foreground">{guestName || user.name}</span>님 글 수정
            </div>
          ) : (
            <div className="text-sm font-medium text-muted-foreground">
              <span className="font-bold text-foreground">{guestName}</span>님 글 수정
            </div>
          )}

          {/* Editor Textarea with focus effect */}
          <div className="relative border border-border/80 rounded-2xl p-4 min-h-[160px] flex flex-col focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all bg-card/50 w-full min-w-0 max-w-full">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, MAX_CHAR_COUNT))}
              onPaste={handlePaste}
              placeholder="내용을 입력하세요... (이미지 붙여넣기 가능)"
              className="w-full flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 focus:outline-none resize-none text-[15px] leading-relaxed"
              maxLength={MAX_CHAR_COUNT}
            />

            {/* Uploaded Images Preview inside editor box */}
            {uploadedImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto py-2 mt-2 border-t border-border/30 w-full min-w-0 max-w-full">
                {uploadedImages.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border shrink-0 bg-muted/30">
                    <img src={img} alt="upload preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Tabs & Word Counter */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleImageButtonClick}
                disabled={uploadState.isUploading}
                className="h-10 px-4 rounded-xl text-sm font-semibold border-border bg-card hover:bg-muted text-foreground flex items-center gap-2"
              >
                {uploadState.isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-muted-foreground" />
                )}
                이미지 추가
              </Button>
            </div>

            <div className="text-xs text-muted-foreground font-mono">
              {content.length} / {MAX_CHAR_COUNT}
            </div>
          </div>

          {/* Anonymous User Credentials (for editing) */}
          {!user && post?.guestName && (
            <div className="space-y-1.5 pt-2 text-left">
              <label className="text-xs font-semibold text-muted-foreground block">
                게시글 비밀번호
              </label>
              <input
                type="password"
                value={guestPassword}
                onChange={(e) => setGuestPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-4 py-3 text-sm rounded-xl border border-border/80 bg-muted/20 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                maxLength={20}
                autoComplete="new-password"
              />
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="h-10 px-5 rounded-xl font-semibold hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={updatePostMutation.isPending || (content.trim() === '' && uploadedImages.length === 0)}
              className={cn(
                "h-10 px-6 rounded-xl font-semibold transition-all text-white",
                content.trim() === '' && uploadedImages.length === 0
                  ? "bg-blue-300 dark:bg-blue-900/50 cursor-not-allowed text-white/80"
                  : "bg-blue-500 hover:bg-blue-600 active:scale-[0.98]"
              )}
            >
              {updatePostMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장'
              )}
            </Button>
          </div>
        </form>

        {/* Upload Progress Overlay */}
        {uploadState.isUploading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-background/70 backdrop-blur-[2px] rounded-2xl">
            <div className="bg-card border border-border text-card-foreground p-6 rounded-2xl shadow-xl flex flex-col gap-4 w-full max-w-[320px] pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-full animate-pulse">
                  <ImageIcon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  이미지 업로드 중 ({uploadState.completed}/{uploadState.total})
                </h3>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-y-0 left-0 bg-blue-500 transition-all duration-200 ease-out rounded-full" 
                    style={{ width: `${uploadState.progress}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-muted-foreground font-mono">
                  <span>진행률</span>
                  <span>{uploadState.progress}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
