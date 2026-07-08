import imageCompression from 'browser-image-compression';
import { apiClient } from '../api-client';

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
      return file;
    }

    // WebP도 animated WebP 보호를 위해 압축하지 않음
    // (browser-image-compression이 애니메이션을 정적 이미지로 변환함)
    if (file.type === 'image/webp') {
      return file;
    }

    const options = {
      maxSizeMB: 2, // 최대 2MB
      maxWidthOrHeight: 1920, // 최대 너비/높이 1920px
      useWebWorker: true,
      fileType: 'image/webp', // WebP로 변환
    };

    try {
      const compressedBlob = await imageCompression(file, options);
      
      // 압축된 Blob을 File 객체로 변환 (확장자 .webp로 변경)
      const compressedFile = new File(
        [compressedBlob],
        file.name.replace(/\.[^/.]+$/, '.webp'),
        { type: 'image/webp', lastModified: new Date().getTime() }
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
      return file; // 압축 실패 시 원본 반환
    }
  },

  /**
   * 이미지 업로드 (자동 압축 적용 가능)
   * @param file 업로드할 파일
   * @param options 옵션 (압축 여부, 진행률 콜백)
   * @returns 업로드된 이미지 URL
   */
  uploadImage: async (
    file: File, 
    options: { compress?: boolean; folder?: string; onProgress?: (progress: number, loaded: number, total: number) => void } = { compress: true }
  ): Promise<string> => {
    let fileToUpload = file;
    
    if (options.compress) {
      fileToUpload = await uploadsApi.compressImage(file);
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    if (options.folder) {
      formData.append('folder', options.folder);
    }

    const response = await apiClient.post('/uploads/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (options.onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(progress, progressEvent.loaded, progressEvent.total);
        }
      },
    });

    const result = response.data;
    const data = result.data || result;
    return data.url;
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
