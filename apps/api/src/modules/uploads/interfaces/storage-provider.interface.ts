export interface UploadResult {
  url: string;
  path: string;
}

/** 이미지 업로드 결과. responsive 업로드면 작은 버전 주소를 srcset으로 함께 돌려준다 */
export interface ImageUploadResult extends UploadResult {
  width?: number;
  height?: number;
  /** <img srcset>에 그대로 넣는 값 (예: "…-w720.webp 720w, …webp 1598w"). 작은 버전이 없으면 undefined */
  srcset?: string;
  /** 함께 저장한 작은 버전 파일 경로 (실패 시 정리용) */
  variantPaths: string[];
}

export interface StorageProvider {
  upload(file: Buffer, path: string, mimeType: string): Promise<UploadResult>;
  delete(path: string): Promise<void>;
  move?(fromPath: string, toPath: string): Promise<UploadResult>;
  deleteDirectory?(path: string): Promise<void>;

  /**
   * 스토리지 URL (Supabase/Local 등)에서 실제 내부 path를 추출합니다.
   * 추출에 실패하면 null을 반환합니다.
   */
  extractPathFromUrl(url: string): string | null;

  /**
   * 임시 폴더에서 특정 시간 이전의 파일들을 모두 정리합니다.
   */
  cleanupTempFiles(olderThan: Date): Promise<void>;
}
