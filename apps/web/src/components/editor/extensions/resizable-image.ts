import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ResizableImageComponent } from './resizable-image-component';

export interface ResizableImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      setImage: (options: {
        src: string;
        srcset?: string | null;
        alt?: string;
        title?: string;
        width?: number;
        height?: number;
      }) => ReturnType;
    };
  }
}

export const ResizableImage = Node.create<ResizableImageOptions>({
  name: 'image',

  addOptions() {
    return {
      inline: false,
      allowBase64: false,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      // 작은 버전 이미지 목록 (서버 업로드 응답). 저장된 HTML에 그대로 남아 글을 볼 때 쓰인다
      srcset: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageComponent, {
      className: 'block w-fit max-w-full',
    });
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
