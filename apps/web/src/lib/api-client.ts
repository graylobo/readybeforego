import { ApiResponse, ErrorCode, ErrorMessages } from '@community/shared-types';
import axios from 'axios';
import { toast } from '@/lib/toast';

declare module 'axios' {
  interface CustomRequestConfig {
    _skipToast?: boolean;
  }
  export interface InternalAxiosRequestConfig extends CustomRequestConfig {}
  export interface AxiosRequestConfig extends CustomRequestConfig {}
}


export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 응답 인터셉터: 데이터 언래핑 및 공통 에러 처리
apiClient.interceptors.response.use(
  (response) => {
    const apiResponse = response.data as ApiResponse<any>;
    
    // 서버의 표준 응답 구조 { success: true, data: ... } 처리
    if (apiResponse && apiResponse.success === true && 'data' in apiResponse) {
      response.data = apiResponse.data;
    }
    return response;
  },
  (error) => {
    // 서버에서 전달한 표준 에러 구조 처리
    const serverError = error.response?.data as ApiResponse<null>;
    
    // 401 Unauthorized 등 특정 에러 코드는 전역적으로 처리하거나 무시
    if (error.response?.status === 401) {
        return Promise.reject(error);
    }

    const isGetMethod = error.config?.method?.toLowerCase() === 'get';
    // _skipToast가 명시적으로 지정되지 않은 경우, GET 요청은 기본적으로 토스트를 건너뜁니다.
    const skipToast = error.config?._skipToast !== undefined ? error.config._skipToast : isGetMethod;

    // 알림(toast)은 브라우저에서만 띄운다. 서버 렌더링 중에 부르면(sonner는 브라우저 전용) 그 호출이 오류를 내며
    // 원래 API 오류를 덮어써서, 페이지가 404 등을 알아채지 못한다 (없는 글/게시판이 404 대신 빈 화면 200으로 응답됨)
    if (typeof window === 'undefined') {
      return Promise.reject(error);
    }

    if (serverError && serverError.success === false) {
      const errorCode = serverError.errorCode as ErrorCode;
      // 서버가 구체적인 이유를 한국어로 보냈으면 그대로 보여준다 (예: "이 게시판은 익명 작성을 허용하지 않습니다.").
      // 입력값 검사 기본 문구처럼 영어로 온 경우에는 오류 코드별 기본 문구를 쓴다
      const serverMessage = typeof serverError.message === 'string' && /[가-힣]/.test(serverError.message)
        ? serverError.message
        : undefined;
      const message = serverMessage || ErrorMessages[errorCode] || '요청 처리 중 오류가 발생했습니다.';
      
      if (!skipToast) {
        toast.error(message);
      }
      
      console.error(`[API Error] ${errorCode}: ${message}`);
      
      // 에러 메시지를 React Query 등의 상위 에러 핸들러에서 참조할 수 있도록 주입
      error.message = message;
    } else {
      if (!skipToast) {
        toast.error('서버와의 통신이 원활하지 않습니다.');
      }
    }

    return Promise.reject(error);
  }
);
