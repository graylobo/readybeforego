'use client';

import { uploadsApi } from '@/lib/api/uploads';
import { cn } from '@/lib/utils';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUpCircle,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo,
  SmilePlus,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
  Youtube as YoutubeIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { ResizableImage } from './extensions/resizable-image';
import { EmoticonPicker } from '@/components/emoticons/emoticon-picker';
import { useAuthStore } from '@/lib/stores/auth.store';

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
};

const MAX_UPLOAD_FILES = 30;
const MAX_FILE_SIZE_MB = 10;

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

const MenuButton = ({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: {
  onClick: (e: React.MouseEvent) => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'p-1.5 rounded-md transition-colors',
      isActive
        ? 'bg-primary/20 text-primary'
        : 'hover:bg-muted text-muted-foreground hover:text-foreground',
      disabled && 'opacity-50 cursor-not-allowed',
    )}
  >
    {children}
  </button>
);

const MenuDivider = () => (
  <div className="w-px h-6 bg-border mx-1" />
);

export function TiptapEditor({
  content,
  onChange,
  placeholder = '내용을 입력하세요...',
  className,
  editable = true,
}: TiptapEditorProps) {
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    completed: 0,
    total: 0,
    currentFileName: '',
    progress: 0,
    loadedBytes: 0,
    totalBytes: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const isUploadingRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: false,
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        allowFullscreen: true,
        HTMLAttributes: {
          class: 'rounded-lg overflow-hidden w-full aspect-video',
        },
      }),
    ],
    content,
    editable,
    immediatelyRender: false, // SSR hydration mismatch 방지
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
          'prose-headings:font-bold prose-headings:text-foreground',
          'prose-p:text-foreground prose-p:leading-relaxed',
          'prose-strong:text-foreground',
          'prose-ul:list-disc prose-ol:list-decimal',
          'prose-li:text-foreground',
          'prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground prose-blockquote:pl-4 prose-blockquote:italic',
          'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
          'prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg',
          'prose-hr:border-border',
          'prose-img:rounded-lg prose-img:max-w-full prose-img:h-auto',
          '[&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-lg',
        ),
      },
      handleDrop: (view, event, slice, moved) => {
        if (isUploadingRef.current) {
          event.preventDefault();
          return true;
        }
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const files = event.dataTransfer.files;
          const hasImages = Array.from(files).some(file => file.type.startsWith('image/'));
          
          if (hasImages) {
            event.preventDefault();
            event.stopPropagation();
            handleImagesUpload(files);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        if (isUploadingRef.current) {
          event.preventDefault();
          return true;
        }
        const items = event.clipboardData?.items;
        const files: File[] = [];
        
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
        }

        if (files.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          handleImagesUpload(files);
          return true;
        }
        
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const handleImagesUpload = useCallback(async (files: FileList | File[]) => {
    if (!editor) return;
    if (isUploadingRef.current) return;

    const allFiles = Array.from(files);
    const imageFiles = allFiles.filter(file => 
      ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
    );

    if (imageFiles.length < allFiles.length) {
      toast.error('JPG, PNG, GIF, WEBP 형식의 이미지 파일만 등록 가능합니다.');
    }

    if (imageFiles.length === 0) return;

    // 파일 개수 제한
    if (imageFiles.length > MAX_UPLOAD_FILES) {
      toast.error(`한 번에 최대 ${MAX_UPLOAD_FILES}개의 이미지만 업로드할 수 있습니다.`);
      return;
    }

    isUploadingRef.current = true;
    setUploadState({
      isUploading: true,
      completed: 0,
      total: imageFiles.length,
      currentFileName: '',
      progress: 0,
      loadedBytes: 0,
      totalBytes: 0,
    });

    let completed = 0;
    const total = imageFiles.length;
    
    try {
      const validUrls: string[] = [];
      for (const file of imageFiles) {
        // 파일 크기 제한
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast.error(`${file.name}: ${MAX_FILE_SIZE_MB}MB를 초과하는 파일은 제외되었습니다.`);
          completed++;
          continue;
        }

        setUploadState(prev => ({
          ...prev,
          currentFileName: file.name,
          loadedBytes: 0,
          totalBytes: file.size,
        }));

        try {
          const url = await uploadsApi.uploadImage(file, {
            compress: true,
            onProgress: (progress: number, loaded: number, totalBytes: number) => {
               const currentGlobalProgress = Math.round((completed / total) * 100 + (progress / total));
               setUploadState(prev => ({
                 ...prev,
                 progress: currentGlobalProgress,
                 loadedBytes: loaded,
                 totalBytes: totalBytes,
               }));
            }
          });
          
          validUrls.push(url);
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
      
      if (validUrls.length > 0) {
        const nodes = validUrls.map(url => ({
          type: 'image',
          attrs: { src: url }
        }));
        
        let command = editor.chain().focus();
        const { selection } = editor.state;
        if (selection && 'node' in selection) {
          command = command.setTextSelection(selection.to);
        }
        
        command.insertContent(nodes).run();
        toast.success(`${validUrls.length}개의 이미지가 업로드되었습니다.`);
      }
    } finally {
      isUploadingRef.current = false;
      setUploadState(prev => ({ ...prev, isUploading: false, progress: 0 }));
    }
  }, [editor]);

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleImagesUpload(files);
    }
    // Reset input to allow selecting the same file again
    event.target.value = '';
  };

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL을 입력하세요', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  
  const addYoutubeVideo = () => {
    const url = window.prompt('YouTube URL을 입력하세요');

    if (url) {
      editor.commands.setYoutubeVideo({
        src: url,
      });
    }
  };

  const addImageUrl = () => {
    const url = window.prompt('이미지 URL을 입력하세요');

    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div
      className={cn('relative border rounded-lg overflow-hidden bg-background flex flex-col', className)}
      onDragEnter={(e) => {
        if (!editable) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          setIsDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!editable) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
          setIsDragging(false);
        }
      }}
      onDragOver={(e) => {
        if (!editable) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        if (!editable) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleImagesUpload(e.dataTransfer.files);
        }
      }}
      onClick={() => {
        if (editor && !editor.isFocused && editable) {
          editor.chain().focus().run();
        }
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30 shrink-0">
          {/* Undo/Redo */}
          <MenuButton
            onClick={(e) => {
              e.stopPropagation(); // Prevent parent focus logic
              editor.chain().focus().undo().run();
            }}
            disabled={!editor.can().undo()}
            title="실행 취소"
          >
            <Undo className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => {
              e.stopPropagation();
              editor.chain().focus().redo().run();
            }}
            disabled={!editor.can().redo()}
            title="다시 실행"
          >
            <Redo className="h-4 w-4" />
          </MenuButton>

          <MenuDivider />

          {/* Headings */}
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
            isActive={editor.isActive('heading', { level: 1 })}
            title="제목 1"
          >
            <Heading1 className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
            isActive={editor.isActive('heading', { level: 2 })}
            title="제목 2"
          >
            <Heading2 className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
            isActive={editor.isActive('heading', { level: 3 })}
            title="제목 3"
          >
            <Heading3 className="h-4 w-4" />
          </MenuButton>

          <MenuDivider />

          {/* Text formatting */}
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleBold().run(); }}
            isActive={editor.isActive('bold')}
            title="굵게"
          >
            <Bold className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleItalic().run(); }}
            isActive={editor.isActive('italic')}
            title="기울임"
          >
            <Italic className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleUnderline().run(); }}
            isActive={editor.isActive('underline')}
            title="밑줄"
          >
            <UnderlineIcon className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleStrike().run(); }}
            isActive={editor.isActive('strike')}
            title="취소선"
          >
            <Strikethrough className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleHighlight().run(); }}
            isActive={editor.isActive('highlight')}
            title="하이라이트"
          >
            <Highlighter className="h-4 w-4" />
          </MenuButton>

          <MenuDivider />

          {/* Alignment */}
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().setTextAlign('left').run(); }}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="왼쪽 정렬"
          >
            <AlignLeft className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().setTextAlign('center').run(); }}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="가운데 정렬"
          >
            <AlignCenter className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().setTextAlign('right').run(); }}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="오른쪽 정렬"
          >
            <AlignRight className="h-4 w-4" />
          </MenuButton>

          <MenuDivider />

          {/* Lists */}
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleBulletList().run(); }}
            isActive={editor.isActive('bulletList')}
            title="글머리 기호"
          >
            <List className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleOrderedList().run(); }}
            isActive={editor.isActive('orderedList')}
            title="번호 매기기"
          >
            <ListOrdered className="h-4 w-4" />
          </MenuButton>

          <MenuDivider />

          {/* Other */}
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleBlockquote().run(); }}
            isActive={editor.isActive('blockquote')}
            title="인용문"
          >
            <Quote className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().toggleCodeBlock().run(); }}
            isActive={editor.isActive('codeBlock')}
            title="코드 블록"
          >
            <Code className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); setLink(); }}
            isActive={editor.isActive('link')}
            title="링크"
          >
            <LinkIcon className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); handleImageButtonClick(); }}
            disabled={uploadState.isUploading}
            title="이미지 업로드"
          >
            {uploadState.isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); addImageUrl(); }}
            title="이미지 URL 삽입"
          >
            <ImagePlus className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); addYoutubeVideo(); }}
            title="유튜브 삽입"
          >
            <YoutubeIcon className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={(e) => { e.stopPropagation(); editor.chain().focus().setHorizontalRule().run(); }}
            title="구분선"
          >
            <Minus className="h-4 w-4" />
          </MenuButton>

          {/* Emoticon Picker - only for logged in users in the toolbar */}
          <EmoticonPickerToolbarButton editor={editor} />
        </div>
      )}

      {uploadState.isUploading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none p-4 bg-background/20 backdrop-blur-[2px]">
          <div className="bg-card border border-border text-card-foreground p-5 rounded-xl shadow-2xl flex flex-col gap-4 w-full max-w-[400px] pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-full">
                <ArrowUpCircle className="w-6 h-6 animate-pulse text-muted-foreground" />
              </div>
              <h3 className="text-[15px] font-semibold">{uploadState.completed}/{uploadState.total} 파일 업로드 진행중</h3>
            </div>
            
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="text-[13px] text-muted-foreground truncate font-mono" title={uploadState.currentFileName}>
                {uploadState.currentFileName}
              </div>
              
              <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-cyan-400 transition-all duration-200 ease-out" 
                  style={{ width: `${uploadState.progress}%` }} 
                />
              </div>
              
              <div className="flex justify-between items-center text-[11px] text-muted-foreground font-medium">
                <span>{uploadState.progress}%</span>
                <span>{formatBytes(uploadState.loadedBytes)}/{formatBytes(uploadState.totalBytes)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className="relative flex-1 flex flex-col min-h-[400px]">
        <EditorContent 
          editor={editor} 
          className="flex-1 cursor-text [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-4 [&_.ProseMirror]:outline-none"
        />

        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary z-50 flex flex-col items-center justify-center pointer-events-none backdrop-blur-[2px] transition-all duration-200">
            <div className="bg-background/90 p-6 rounded-2xl shadow-xl border border-primary/20 flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ImagePlus className="w-8 h-8 text-primary animate-bounce" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">이미지를 여기에 놓으세요</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Emoticon picker toolbar button for Tiptap
function EmoticonPickerToolbarButton({ editor }: { editor: any }) {
  const { user } = useAuthStore();

  if (!user) return null;

  const handleSelect = (url: string) => {
    // Insert emoticon as a small inline image
    editor.chain().focus().insertContent({
      type: 'image',
      attrs: {
        src: url,
        alt: 'emoticon',
        title: 'emoticon',
        style: 'width:64px;height:64px;display:inline-block;vertical-align:middle;margin:2px 4px;',
      },
    }).run();
  };

  return (
    <EmoticonPicker
      onSelect={handleSelect}
      className="relative"
    />
  );
}

// 읽기 전용 뷰어
export function TiptapViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <TiptapEditor
      content={content}
      onChange={() => {}}
      editable={false}
      className={className}
    />
  );
}

 