import imageCompression from 'browser-image-compression';
import { apiClient } from '../api-client';

interface UploadImageOptions {
  compress?: boolean;
  folder?: string;
  /** 'emoticon'이면 서버가 이모티콘 크기(최대 480px)로 줄여 저장한다 */
  purpose?: 'emoticon';
  onProgress?: (progress: number, loaded: number, total: number) => void;
  /** 실패 안내를 호출한 쪽에서 직접 띄울 때 공통 오류 알림을 끈다 */
  skipToast?: boolean;
  timeoutMs?: number;
}

// 느린 모바일 회선에서 멈춘 요청을 끝없이 기다리지 않도록 한 장당 제한을 둔다
const UPLOAD_TIMEOUT_MS = 120_000;
const UPLOAD_MAX_ATTEMPTS = 3;

let webpEncodable: boolean | undefined;

// iOS Safari는 WebP로 저장하지 못하고 PNG를 돌려준다. 그러면 사진이 오히려 커지므로 JPEG로 압축한다
function canEncodeWebp(): boolean {
  if (webpEncodable === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpEncodable = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpEncodable;
}

// 휴대폰에서 고른 파일은 나중에 읽으려 하면 실패할 수 있어(임시 파일 만료 등) 고른 시점에 메모리로 읽어 둔다
async function readIntoMemory(file: File): Promise<File> {
  try {
    return new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified });
  } catch (error) {
    console.error('Image read failed:', error);
    return file;
  }
}

async function uploadImageRequest(
  file: File,
  options: UploadImageOptions,
  responsive = false,
): Promise<{ url: string; srcset?: string | null; width?: number | null; height?: number | null }> {
  let fileToUpload = file;

  if (options.compress) {
    fileToUpload = await uploadsApi.compressImage(file);
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);
  if (options.folder) {
    formData.append('folder', options.folder);
  }
  if (responsive) {
    formData.append('responsive', 'true');
  }
  if (options.purpose) {
    formData.append('purpose', options.purpose);
  }

  const response = await apiClient.post('/uploads/images', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    _skipToast: options.skipToast,
    timeout: options.timeoutMs,
    onUploadProgress: (progressEvent) => {
      if (options.onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        options.onProgress(progress, progressEvent.loaded, progressEvent.total);
      }
    },
  });

  const result = response.data;
  return result.data || result;
}

export const uploadsApi = {
  /**
   * 이미지 압축
   * @param file 원본 파일
   * @returns 압축된 파일
   */
  compressImage: async (file: File): Promise<File> => {
    // 이미지 파일이 아니면 압축하지 않음
    if (!file.type.startsWith('image/')) {
      return file;
    }

    // GIF는 압축 시 애니메이션이 깨질 수 있으므로 제외
    if (file.type === 'image/gif') {
      return readIntoMemory(file);
    }

    // WebP도 animated WebP 보호를 위해 압축하지 않음
    // (browser-image-compression이 애니메이션을 정적 이미지로 변환함)
    if (file.type === 'image/webp') {
      return readIntoMemory(file);
    }

    const outputType = canEncodeWebp() ? 'image/webp' : 'image/jpeg';
    const options = {
      maxSizeMB: 2, // 최대 2MB
      maxWidthOrHeight: 1920, // 최대 너비/높이 1920px
      useWebWorker: true,
      fileType: outputType,
    };

    try {
      const compressedBlob = await imageCompression(file, options);
      
      // 압축된 Blob을 File 객체로 변환 (확장자도 결과 형식에 맞춘다)
      const compressedFile = new File(
        [compressedBlob],
        file.name.replace(/\.[^/.]+$/, outputType === 'image/webp' ? '.webp' : '.jpg'),
        { type: outputType, lastModified: new Date().getTime() }
      );

      console.log(
        `Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(
          compressedFile.size /
          1024 /
          1024
        ).toFixed(2)}MB`
      );
      return compressedFile;
    } catch (error) {
      console.error('Image compression failed:', error);
      return readIntoMemory(file); // 압축 실패 시 원본 반환
    }
  },

  /**
   * 이미지 업로드 (자동 압축 적용 가능)
   * @param file 업로드할 파일
   * @param options 옵션 (압축 여부, 진행률 콜백)
   * @returns 업로드된 이미지 URL
   */
  uploadImage: async (file: File, options: UploadImageOptions = { compress: true }): Promise<string> => {
    const data = await uploadImageRequest(file, options);
    return data.url;
  },

  /**
   * 끊기기 쉬운 모바일 회선용 업로드. 연결 오류와 서버 오류만 다시 시도하고, 실패 안내는 호출한 쪽에서 한 번만 띄운다
   * (uploadFailureMessage 참고)
   */
  uploadImageWithRetry: async (file: File, options: UploadImageOptions): Promise<string> => {
    const target = options.compress ? await uploadsApi.compressImage(file) : file;
    for (let attempt = 1; ; attempt++) {
      try {
        return await uploadsApi.uploadImage(target, {
          ...options,
          compress: false,
          skipToast: true,
          timeoutMs: UPLOAD_TIMEOUT_MS,
        });
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (attempt >= UPLOAD_MAX_ATTEMPTS || (status && status < 500)) throw error;
        console.warn(`[Image Upload Retry ${attempt}/${UPLOAD_MAX_ATTEMPTS}]`, error);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  },

  /**
   * 게시글 본문 이미지 업로드. 서버가 작은 버전(720/1280px)을 함께 저장하고 srcset을 돌려준다
   * (본문에서 화면 크기에 맞는 이미지를 받게 하기 위함. 댓글/프로필 등은 uploadImage 사용)
   */
  uploadContentImage: async (
    file: File,
    options: UploadImageOptions = { compress: true },
  ): Promise<{ url: string; srcset?: string; width?: number; height?: number }> => {
    const data = await uploadImageRequest(file, options, true);
    return {
      url: data.url,
      srcset: data.srcset ?? undefined,
      width: data.width ?? undefined,
      height: data.height ?? undefined,
    };
  },

  /**
   * 이미지 삭제 (URL 기반)
   * 댓글 첨부 이미지를 교체할 때 이전 이미지를 스토리지에서 삭제
   */
  deleteImage: async (url: string): Promise<void> => {
    try {
      await apiClient.delete('/uploads/images', { data: { url } });
    } catch {
      // 삭제 실패는 조용히 무시 (고아 이미지는 후에 cleanup job이 처리)
      console.warn('Failed to delete image from storage:', url);
    }
  },
};

/** 업로드 실패 안내 문구. position은 몇 번째 사진인지 (1부터) */
export function uploadFailureMessage(error: unknown, position: number): string {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } })?.response;
  const status = response?.status;
  if (status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';

  const serverMessage = response?.data?.message;
  if (status && status < 500 && typeof serverMessage === 'string' && /[가-힣]/.test(serverMessage)) {
    return `${position}번째 사진: ${serverMessage}`;
  }
  if (status) {
    return `${position}번째 사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요. (오류 ${status})`;
  }
  return `${position}번째 사진을 올리지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요. 작성한 내용은 그대로 있습니다.`;
}
