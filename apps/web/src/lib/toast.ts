import { toast as sonnerToast, ExternalToast } from 'sonner';
import React from 'react';

/**
 * 전역 토스트 유틸리티
 * 동일한 내용의 토스트가 여러 번 뜨는 것을 방지하기 위해 
 * 메시지 내용을 ID로 사용합니다.
 */
export const toast = {
  ...sonnerToast,
  error: (message: string | React.ReactNode, options?: ExternalToast) => {
    const id = typeof message === 'string' ? message : undefined;
    return sonnerToast.error(message, { id, ...options });
  },
  success: (message: string | React.ReactNode, options?: ExternalToast) => {
    const id = typeof message === 'string' ? message : undefined;
    return sonnerToast.success(message, { id, ...options });
  },
  info: (message: string | React.ReactNode, options?: ExternalToast) => {
    const id = typeof message === 'string' ? message : undefined;
    return sonnerToast.info(message, { id, ...options });
  },
  warning: (message: string | React.ReactNode, options?: ExternalToast) => {
    const id = typeof message === 'string' ? message : undefined;
    return sonnerToast.warning(message, { id, ...options });
  },
};
