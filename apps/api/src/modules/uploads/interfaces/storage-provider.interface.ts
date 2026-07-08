export interface UploadResult {
  url: string;
  path: string;
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
