'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImageIcon, Loader2, X } from 'lucide-react';
import { CommentTree } from '@/lib/api/comments';
import { EmoticonPicker } from '@/components/emoticons/emoticon-picker';
import { uploadsApi } from '@/lib/api/uploads';
import { toast } from '@/lib/toast';
import { SmartImage } from '@/components/common/smart-image';

interface CommentEditFormProps {
  comment: CommentTree;
  parentComment: CommentTree | null;
  onSave: (content: string, imageUrl?: string | null, emoticonUrl?: string | null) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function CommentEditForm({
  comment,
  parentComment,
  onSave,
  onCancel,
  isSaving = false,
}: CommentEditFormProps) {
  const parentName = parentComment
    ? (parentComment.userName || parentComment.userEmail || parentComment.guestName)
    : null;

  const [hasMention, setHasMention] = useState(() => {
    if (comment.parentId && parentName) {
      const mention = `@${parentName} `;
      return (comment.content ?? '').startsWith(mention);
    }
    return false;
  });

  const [content, setContent] = useState(() => {
    if (comment.parentId && parentName) {
      const mention = `@${parentName} `;
      if ((comment.content ?? '').startsWith(mention)) {
        return (comment.content ?? '').slice(mention.length);
      }
    }
    return comment.content ?? '';
  });

  // Emoticon state
  const [emoticonUrl, setEmoticonUrl] = useState<string | null>((comment as any).emoticonUrl || null);
  
  const originalImageUrl = (comment as any).imageUrl || null;
  const [imageUrl, setImageUrl] = useState<string | null>(originalImageUrl);
  const [imagePreview, setImagePreview] = useState<string | null>(originalImageUrl);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (file: File) => {
    // If we already uploaded a NEW image in this editing session, delete it first
    if (imageUrl && imageUrl !== originalImageUrl) {
      uploadsApi.deleteImage(imageUrl);
    }

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setImageUrl(null); 
    setImageUploading(true);
    setEmoticonUrl(null); 

    try {
      const isAnimated = file.type === 'image/gif' || file.type === 'image/webp';
      const url = await uploadsApi.uploadImage(file, {
        compress: !isAnimated,
        folder: 'comments',
      });
      setImageUrl(url);
    } catch {
      toast.error('이미지 업로드에 실패했습니다.');
      setImagePreview(null);
    } finally {
      setImageUploading(false);
    }
  };

  const handleRemoveImage = () => {
    // If it's a NEW image uploaded during this session, delete it from storage
    if (imageUrl && imageUrl !== originalImageUrl) {
      uploadsApi.deleteImage(imageUrl);
    }
    setImageUrl(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleCancel = () => {
    // If we have a NEW image uploaded during this session, delete it because we're cancelling
    if (imageUrl && imageUrl !== originalImageUrl) {
      uploadsApi.deleteImage(imageUrl);
    }
    onCancel();
  };

  const handleSave = () => {
    if (!content?.trim() && !emoticonUrl && !imageUrl) {
        toast.error('내용, 이모티콘, 또는 이미지를 입력해주세요.');
        return;
    }
    
    let finalContent = content;
    if (hasMention && parentName) {
      finalContent = `@${parentName} ${content}`;
    }
    
    onSave(finalContent, imageUrl, emoticonUrl);
  };

  return (
    <div className="space-y-3 pt-1">
      {comment.parentId && hasMention && parentName && (
        <div className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md">
          <span className="font-semibold select-none">@{parentName}</span>
          <button
            onClick={() => setHasMention(false)}
            className="hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Media Previews */}
      <div className="flex flex-wrap gap-2">
        {emoticonUrl && (
          <div className="relative inline-block border border-border/50 rounded-xl bg-muted/20 p-1">
            <SmartImage
              src={emoticonUrl}
              alt="emoticon"
              className="w-16 h-16 object-contain"
              fallbackClassName="w-16 h-16"
              showErrorText={false}
            />
            <button
              type="button"
              onClick={() => setEmoticonUrl(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center shadow hover:bg-destructive/90 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}

        {imagePreview && (
          <div className="relative inline-block border border-border/50 rounded-xl bg-muted/20 p-1">
            <SmartImage
              src={imagePreview}
              alt="attached"
              className="max-w-[120px] max-h-[120px] object-contain"
              fallbackClassName="w-[120px] h-[80px]"
            />
            {imageUploading && (
              <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            {!imageUploading && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center shadow hover:bg-destructive/90 transition-colors"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[100px] text-sm resize-none focus:ring-1 focus:ring-primary pb-8"
          placeholder="수정할 내용을 입력하세요..."
          maxLength={1000}
        />
        <div className="absolute bottom-2 right-3 text-xs text-muted-foreground pointer-events-none">
          {content?.length || 0} / 1000
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
           {/* Image attach button */}
           <button
             type="button"
             title="이미지 교체/추가"
             onClick={() => imageInputRef.current?.click()}
             disabled={isSaving || imageUploading}
             className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 cursor-pointer"
           >
             {imageUploading
               ? <Loader2 className="w-4 h-4 animate-spin" />
               : <ImageIcon className="w-4 h-4" />
             }
           </button>

           {/* Emoticon picker */}
           <EmoticonPicker
             onSelect={(url) => {
                 setEmoticonUrl(url);
                 handleRemoveImage(); // prioritize one media
             }}
             disabled={isSaving}
           />
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || imageUploading}
            className="cursor-pointer active:scale-95 transition-transform font-bold"
          >
            {isSaving ? '수정 중...' : '수정'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="cursor-pointer active:scale-95 transition-transform"
          >
            취소
          </Button>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleImageSelect(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

