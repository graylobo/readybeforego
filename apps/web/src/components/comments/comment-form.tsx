'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/lib/stores/auth.store';
import { CreateCommentDto, CreateCommentSchema } from '@community/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { ImageIcon, Loader2, X } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from '@/lib/toast';
import { EmoticonPicker } from '@/components/emoticons/emoticon-picker';
import { uploadsApi } from '@/lib/api/uploads';
import { SmartImage } from '@/components/common/smart-image';

interface CommentFormProps {
  targetId: string;
  targetType: string;
  onSubmit: (data: CreateCommentDto) => void;
  isPending: boolean;
  parentId?: string;
  initialContent?: string;
  replyToName?: string;
  onCancel?: () => void;
  allowAnonymous?: boolean;
}

let sessionGuestName: string | null = null;

const generateRandomGuestName = () => {
    if (sessionGuestName) return sessionGuestName;
    const prefixes = ['이방인', '구경꾼', '나그네', '지나가던', '손님'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    sessionGuestName = `${prefix}${num}`;
    return sessionGuestName;
};

export function CommentForm({
  targetId,
  targetType,
  onSubmit,
  isPending,
  parentId,
  initialContent = '',
  replyToName,
  onCancel,
  allowAnonymous = false,
}: CommentFormProps) {
  const { user } = useAuthStore();
  const isRootComment = !parentId;

  // Emoticon state
  const [selectedEmoticon, setSelectedEmoticon] = useState<string | null>(null);
  // Image attachment state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
  } = useForm<CreateCommentDto>({
    resolver: zodResolver(CreateCommentSchema),
    defaultValues: {
      targetId,
      targetType,
      content: initialContent,
      parentId,
      guestName: !user && allowAnonymous ? generateRandomGuestName() : undefined,
      guestPassword: !user && allowAnonymous ? undefined : undefined,
    },
  });

  // Sync state to react-hook-form for validation
  useEffect(() => {
    setValue('emoticonUrl', selectedEmoticon ?? undefined);
  }, [selectedEmoticon, setValue]);

  const content = watch('content');
  const guestName = watch('guestName');

  // 이미지 선택 시: 로컬 미리보기 생성 및 파일 보관 (업로드는 제출 시 수행)
  const handleImageSelect = (file: File) => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
    setImageFile(file);
    setSelectedEmoticon(null); // 이모티콘과 이미지 중 택일
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleFormSubmit = async (data: CreateCommentDto) => {
    if (!data.content?.trim() && !selectedEmoticon && !imageFile) {
      toast.error('내용, 이모티콘, 또는 이미지를 입력해주세요.');
      return;
    }
    if (data.guestName) {
      sessionGuestName = data.guestName;
    }
    if (replyToName) {
      data = { ...data, content: `@${replyToName} ${data.content ?? ''}` };
    }

    setImageUploading(true);
    try {
      let uploadedUrl: string | undefined = undefined;
      if (imageFile) {
        const isAnimated = imageFile.type === 'image/gif' || imageFile.type === 'image/webp';
        uploadedUrl = await uploadsApi.uploadImage(imageFile, {
          compress: !isAnimated,
          folder: 'comments',
        });
      }

      const finalData: CreateCommentDto = {
        ...data,
        emoticonUrl: selectedEmoticon ?? undefined,
        imageUrl: uploadedUrl ?? undefined,
      };

      onSubmit(finalData);

      if (!parentId) {
        reset({
          ...data,
          content: '',
          guestName: !user && allowAnonymous ? generateRandomGuestName() : undefined,
          guestPassword: !user && allowAnonymous ? '' : undefined,
        });
        setSelectedEmoticon(null);
        setImageFile(null);
        if (imagePreview) {
          URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(null);
        if (imageInputRef.current) imageInputRef.current.value = '';
      }
    } catch (err) {
      toast.error('이미지 업로드에 실패했습니다.');
    } finally {
      setImageUploading(false);
    }
  };

  const onInvalid = (errors: any) => {
    const errorMessages = Object.values(errors)
      .map((error: any) => error.message)
      .filter(Boolean);
    if (errorMessages.length > 0) {
      toast.error(errorMessages[0] as string);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, onInvalid)} className="space-y-4">
      <div className="space-y-3">
        {!user && allowAnonymous && (
          <div className="flex flex-wrap gap-2">
            <div className="relative flex items-center w-[160px]">
              <input
                type="text"
                {...register('guestName')}
                placeholder="닉네임"
                className="w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:ring-1 focus:ring-primary outline-none"
              />
              {guestName && (
                <button
                  type="button"
                  onClick={() => setValue('guestName', '')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="w-[140px]">
              <input
                type="password"
                {...register('guestPassword')}
                placeholder="비밀번호"
                className="w-full px-3 py-1.5 text-sm border rounded-md bg-background focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
        )}

        {replyToName && (
          <p className="text-sm font-semibold text-muted-foreground">
            @{replyToName}님에게 답글 작성
          </p>
        )}

        {/* Emoticon preview */}
        {selectedEmoticon && (
          <div className="relative inline-block">
            <SmartImage
              src={selectedEmoticon}
              alt="selected emoticon"
              className="w-20 h-20 object-contain border border-border/50 rounded-xl bg-muted/20"
              fallbackClassName="w-20 h-20"
              showErrorText={false}
            />
            <button
              type="button"
              onClick={() => setSelectedEmoticon(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center shadow"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}

        {/* Image preview */}
        {imagePreview && (
          <div className="relative inline-block">
            <SmartImage
              src={imagePreview}
              alt="attached"
              className="max-w-[200px] max-h-[200px] object-contain border border-border/50 rounded-xl bg-muted/20"
              fallbackClassName="w-40 h-32"
            />
            {imageUploading && (
              <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            {!imageUploading && (
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center shadow"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        )}

        <div className="relative">
          <Textarea
            {...register('content')}
            id={!parentId ? 'root-comment-textarea' : undefined}
            placeholder={parentId ? '답글을 입력하세요...' : '댓글을 입력하세요...'}
            className="min-h-[100px] text-sm md:text-base resize-none focus:ring-1 focus:ring-primary p-3 pb-8"
            maxLength={1000}
          />
          <div className="absolute bottom-2 right-3 text-xs text-muted-foreground pointer-events-none">
            {content?.length || 0} / 1000
          </div>
        </div>

        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-1">
            {user && (
              <>
                {/* Image attach button */}
                <button
                  type="button"
                  title="이미지 첨부 (1장)"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isPending || imageUploading}
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
                    setSelectedEmoticon(url);
                    removeImage();
                  }}
                  disabled={isPending}
                />
              </>
            )}
          </div>

          <div className="flex gap-2">
            {onCancel && (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                취소
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isPending || imageUploading} className="font-bold">
              {isPending ? '작성 중...' : parentId ? '답글 작성' : '댓글 작성'}
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleImageSelect(file);
          e.target.value = ''; // reset so same file can be re-selected
        }}
      />
    </form>
  );
}
