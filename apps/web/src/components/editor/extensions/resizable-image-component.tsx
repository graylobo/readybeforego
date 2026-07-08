'use client';

import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils'; // path adjusted

export function ResizableImageComponent({
  node,
  updateAttributes,
  selected,
  editor,
}: NodeViewProps) {
  const { src, alt, title, width, height } = node.attrs;
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const startPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // 에디터가 편집 가능한 상태인지 확인
  const isEditable = editor.isEditable;

  // 리사이즈 핸들 표시 여부: 편집 가능 + 선택된 상태
  const showResizeHandles = isEditable && selected;

  const handleStart = useCallback(
    (clientX: number, clientY: number, direction: string) => {
      if (!imageRef.current) return;

      const rect = imageRef.current.getBoundingClientRect();
      startPos.current = {
        x: clientX,
        y: clientY,
        width: rect.width,
        height: rect.height,
      };

      setIsResizing(true);
      setResizeDirection(direction);
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, direction: string) => {
      e.preventDefault();
      e.stopPropagation();
      handleStart(e.clientX, e.clientY, direction);
    },
    [handleStart]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, direction: string) => {
      e.stopPropagation();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY, direction);
      }
    },
    [handleStart]
  );

  const handleResizeMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isResizing || !resizeDirection) return;

      const deltaX = clientX - startPos.current.x;

      let newWidth = startPos.current.width;
      let newHeight = startPos.current.height;

      // 원본 비율 유지
      const aspectRatio = startPos.current.width / startPos.current.height;

      switch (resizeDirection) {
        case 'se': // 오른쪽 아래
          newWidth = Math.max(100, startPos.current.width + deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'sw': // 왼쪽 아래
          newWidth = Math.max(100, startPos.current.width - deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'ne': // 오른쪽 위
          newWidth = Math.max(100, startPos.current.width + deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'nw': // 왼쪽 위
          newWidth = Math.max(100, startPos.current.width - deltaX);
          newHeight = newWidth / aspectRatio;
          break;
        case 'e': // 오른쪽
        case 'w': // 왼쪽
          const widthDelta = resizeDirection === 'e' ? deltaX : -deltaX;
          newWidth = Math.max(100, startPos.current.width + widthDelta);
          newHeight = newWidth / aspectRatio;
          break;
      }

      updateAttributes({
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });
    },
    [isResizing, resizeDirection, updateAttributes]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleResizeMove(e.clientX, e.clientY);
    },
    [handleResizeMove]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        if (isResizing) {
          // 리사이징 중에는 스크롤 방지
          if (e.cancelable) e.preventDefault();
        }
        const touch = e.touches[0];
        handleResizeMove(touch.clientX, touch.clientY);
      }
    },
    [handleResizeMove, isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeDirection(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleTouchMove, handleMouseUp]);

  // 이미지 로드 시 초기 크기 설정 (편집 모드에서만)
  const handleImageLoad = useCallback(() => {
    if (!isEditable) return;

    if (!width && !height && imageRef.current) {
      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;

      // 최대 너비 제한 (에디터 컨테이너 기준)
      const maxWidth = 600;
      if (naturalWidth > maxWidth) {
        const ratio = maxWidth / naturalWidth;
        updateAttributes({
          width: Math.round(maxWidth),
          height: Math.round(naturalHeight * ratio),
        });
      }
    }
  }, [width, height, updateAttributes, isEditable]);

  // wrapper 클릭 시 이미지 영역 외부면 선택 해제
  const handleWrapperClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX;
      const clickY = e.clientY;

      // 클릭이 실제 이미지 컨테이너 영역 외부인지 확인
      const isOutside =
        clickX < containerRect.left ||
        clickX > containerRect.right ||
        clickY < containerRect.top ||
        clickY > containerRect.bottom;

      if (isOutside) {
        // 이미지 외부 클릭 시 에디터의 끝으로 커서 이동하여 선택 해제
        e.preventDefault();
        e.stopPropagation();
        editor.commands.blur();
      }
    },
    [isEditable, editor]
  );

  return (
    <NodeViewWrapper
      className="my-4 block w-fit"
      onClick={handleWrapperClick}
      data-drag-handle=""
    >
      <div
        ref={containerRef}
        className={cn(
          'relative inline-block transition-all duration-200 rounded-lg',
          isEditable && !showResizeHandles && !isResizing && 'cursor-pointer hover:ring-2 hover:ring-primary/40 hover:ring-offset-2',
          showResizeHandles && 'ring-2 ring-primary ring-offset-2',
          isResizing && 'cursor-nwse-resize'
        )}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt || ''}
          title={title || ''}
          width={width || undefined}
          height={height || undefined}
          onLoad={handleImageLoad}
          className={cn(
            'max-w-full h-auto rounded-lg block',
            isResizing && 'pointer-events-none'
          )}
          draggable={false}
        />

        {/* Resize handles - 편집 모드 + 선택 시에만 표시 */}
        {showResizeHandles && (
          <>
            {/* 모서리 핸들 */}
            {['nw', 'ne', 'sw', 'se'].map((dir) => (
              <div
                key={dir}
                onMouseDown={(e) => handleMouseDown(e, dir)}
                onTouchStart={(e) => handleTouchStart(e, dir)}
                className={cn(
                  'absolute w-3 h-3 bg-primary border-2 border-white rounded-full shadow-md z-10',
                  dir === 'nw' &&
                    'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
                  dir === 'ne' &&
                    'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
                  dir === 'sw' &&
                    'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
                  dir === 'se' &&
                    'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'
                )}
              />
            ))}

            {/* 좌우 핸들 */}
            <div
              onMouseDown={(e) => handleMouseDown(e, 'w')}
              onTouchStart={(e) => handleTouchStart(e, 'w')}
              className="absolute top-1/2 left-0 w-2 h-8 bg-primary/80 rounded-r -translate-y-1/2 cursor-ew-resize z-10"
            />
            <div
              onMouseDown={(e) => handleMouseDown(e, 'e')}
              onTouchStart={(e) => handleTouchStart(e, 'e')}
              className="absolute top-1/2 right-0 w-2 h-8 bg-primary/80 rounded-l -translate-y-1/2 cursor-ew-resize z-10"
            />
          </>
        )}

        {/* 크기 표시 (리사이징 중) */}
        {isResizing && width && height && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {width} × {height}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
