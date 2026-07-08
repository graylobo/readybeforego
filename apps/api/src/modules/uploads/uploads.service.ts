import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import type { StorageProvider, UploadResult } from './interfaces/storage-provider.interface';
import { UPLOAD_LIMITS, IMAGE_PROCESSING } from '@community/shared-types';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly storageProvider: StorageProvider,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 이미지 업로드 (원본 저장 후 백그라운드 처리 예약)
   */
  async uploadImage(
    fileData: Buffer,
    mimeType: string,
    folder: string = 'temp',
    userId?: string,
  ): Promise<UploadResult> {
    // 파일 크기 검증
    if (fileData.length > UPLOAD_LIMITS.IMAGE_SIZE) {
      throw new BadRequestException(
        `파일 크기가 너무 큽니다. (최대 ${UPLOAD_LIMITS.IMAGE_SIZE / 1024 / 1024}MB)`,
      );
    }

    // MIME 타입 검증
    if (!UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new BadRequestException(
        `허용되지 않는 파일 형식입니다: ${mimeType}. 허용 목록: ${UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.join(', ')}`,
      );
    }

    // 고유한 파일 경로 생성
    const timestamp = Date.now();
    const uuid = uuidv4().split('-')[0];
    const extension = 'webp'; // 항상 webp로 저장될 예정
    const fileName = `${timestamp}-${uuid}.${extension}`;
    const filePath = userId
      ? `${folder}/${userId}/${fileName}`
      : `${folder}/${fileName}`;

    // 1단계: 원본 데이터를 빠르게 WebP로만 변환하여 업로드 (최소한의 처리)
    let initialBuffer = fileData;
    try {
      const isAnimated = mimeType === 'image/gif' || mimeType === 'image/webp';
      initialBuffer = await sharp(fileData, { animated: isAnimated })
        .webp({ quality: 90 }) // 초기에는 고화질로 빠르게 저장
        .toBuffer();
    } catch (error) {
      this.logger.error('Initial image conversion failed', error);
    }

    const result = await this.storageProvider.upload(initialBuffer, filePath, 'image/webp');

    // 2단계: 백그라운드 최적화 (리사이징 및 추가 압축) 이벤트 발행
    // 메모리에 있는 buffer를 직접 넘겨주어 저장소에서 다시 다운로드(Egress 비용 발생)하는 것을 방지합니다.
    this.eventEmitter.emit('image.uploaded', {
      path: filePath,
      buffer: initialBuffer,
      mimeType: 'image/webp',
    });

    return result;
  }

  /**
   * 백그라운드 이미지 최적화 프로세서
   */
  @OnEvent('image.uploaded', { async: true })
  async handleImageOptimization(payload: { path: string; buffer: Buffer; mimeType: string }) {
    const { path, buffer } = payload;
    
    try {
      this.logger.log(`Checking optimization necessity for: ${path}`);
      
      // 1. 전달받은 buffer를 바로 사용 (다운로드 생략으로 Egress 절약)
      
      // 2. Sharp를 이용한 메타데이터 확인
      const image = sharp(buffer, { animated: true });
      const metadata = await image.metadata();

      // 중복 압축 방지 조건: 이미 WebP이고, 크기가 적절하며, 해상도가 기준 내라면 스킵
      // 특히 애니메이션 이미지(GIF/WebP)는 재압축 시 품질 저하나 용량 증가가 발생하기 쉬우므로 
      // 이미 WebP인 경우는 웬만하면 스킵합니다.
      const isAnimated = metadata.pages && metadata.pages > 1;
      const alreadyOptimized = 
        metadata.format === 'webp' && 
        ((metadata.width || 0) <= IMAGE_PROCESSING.MAX_WIDTH || isAnimated) && 
        (buffer.length < 3 * 1024 * 1024 || isAnimated); 

      if (alreadyOptimized) {
        this.logger.log(`Optimization skipped: ${path} (Already meets standards or is animated WebP)`);
        return;
      }

      this.logger.log(`Starting background optimization for: ${path}`);
      let pipeline = image;

      // 리사이징 (한계치보다 큰 경우에만)
      if (metadata.width && metadata.width > IMAGE_PROCESSING.MAX_WIDTH) {
        pipeline = pipeline.resize({
          width: IMAGE_PROCESSING.MAX_WIDTH,
          withoutEnlargement: true,
          fit: 'inside',
        });
      }

      const processedBuffer = await pipeline
        .webp({ quality: IMAGE_PROCESSING.QUALITY })
        .toBuffer();

      // 3. 최적화된 파일로 교체 (덮어쓰기)
      await this.storageProvider.upload(processedBuffer, path, 'image/webp');
      
      this.logger.log(`Optimization completed: ${path} (${(buffer.length / 1024).toFixed(1)}KB -> ${(processedBuffer.length / 1024).toFixed(1)}KB)`);
    } catch (error) {
      this.logger.error(`Background optimization failed for ${path}:`, error);
    }
  }

  /**
   * 이미지 이동 (Temp -> Public)
   */
  async moveImage(fromPath: string, toPath: string): Promise<UploadResult> {
    if (this.storageProvider.move) {
        return this.storageProvider.move(fromPath, toPath);
    }
    throw new BadRequestException('Move operation not supported by current storage provider');
  }

  async deleteImage(path: string): Promise<void> {
    return this.storageProvider.delete(path);
  }

  async deleteDirectory(path: string): Promise<void> {
    if (this.storageProvider.deleteDirectory) {
        return this.storageProvider.deleteDirectory(path);
    }
  }

  extractPathFromUrl(url: string): string | null {
    return this.storageProvider.extractPathFromUrl(url);
  }

  /**
   * 본문에서 사용된 이미지 URL 추출
   */
  extractImagePaths(content: string, targetFolder: string): string[] {
    if (!content) return [];
    
    // 타겟 폴더 내의 파일들을 추출하는 정규식
    const escapedFolder = targetFolder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const urlRegex = new RegExp(`([^'"()\\s]*\\/${escapedFolder}\\/[^'"()\\s]+)`, 'g');
    const matches = [...content.matchAll(urlRegex)];
    
    const paths = Array.from(new Set(matches.map(m => {
      const fullUrl = m[0];
      const pathIndex = fullUrl.indexOf(`${targetFolder}/`);
      if (pathIndex === -1) return null;
      
      const pathWithExtras = fullUrl.substring(pathIndex);
      return pathWithExtras.split(/[?#]/)[0];
    })));

    return paths.filter((p): p is string => p !== null);
  }

  /**
   * 수정 전후 내용을 비교하여 지워진 (고아) 이미지를 스토리지에서 삭제
   */
  async cleanupOrphanImages(oldContent: string, newContent: string, targetFolder: string) {
    const oldPaths = this.extractImagePaths(oldContent, targetFolder);
    const newPaths = this.extractImagePaths(newContent, targetFolder);

    const orphanPaths = oldPaths.filter(path => !newPaths.includes(path));

    if (orphanPaths.length > 0) {
      this.logger.log(`Found ${orphanPaths.length} orphan images to delete in ${targetFolder}`);
      
      // 백그라운드 서버 비동기 삭제 (이것 때문에 API 응답이 지연되지 않도록 await하지 않음)
      Promise.all(orphanPaths.map(async (path) => {
        try {
          await this.deleteImage(path);
          this.logger.log(`Deleted orphan image in background: ${path}`);
        } catch (error) {
          this.logger.error(`Failed to delete orphan image: ${path}`, error);
        }
      })).catch(err => {
        this.logger.error(`Cleanup tasks failed completely for ${targetFolder}`, err);
      });
    }
  }

  /**
   * content 내의 temp 이미지를 영구 폴더로 이동
   */
  async moveTempImages(content: string, targetFolder: string): Promise<string> {
    if (!content) return content;

    const tempUrlRegex = /([^'"()\s]*\/temp\/[^'"()\s]+)/g;
    let newContent = content;
    
    // 중복 URL 처리 방지
    const uniqueUrls = Array.from(new Set([...content.matchAll(tempUrlRegex)].map(m => m[0])));

    const moveTasks: Array<{fromPath: string, toPath: string}> = [];

    for (const fullUrl of uniqueUrls) {
      const pathIndex = fullUrl.indexOf('temp/');
      if (pathIndex === -1) continue;

      const fromPathWithPossibleExtras = fullUrl.substring(pathIndex);
      const fromPath = fromPathWithPossibleExtras.split(/[?#]/)[0];
      
      const filename = fromPath.split('/').pop();
      if (!filename) continue;
      
      const toPath = `${targetFolder}/${filename}`;
      
      // 즉시 URL 치환 (Supabase는 URL 구조가 일정하므로 경로만 바꾸면 올바른 URL이 됨)
      const newUrl = fullUrl.replace(fromPath, toPath);
      newContent = newContent.split(fullUrl).join(newUrl);

      moveTasks.push({ fromPath, toPath });
    }

    // 백그라운드에서 비동기로 파일 이동 처리 (await 없음 -> 즉시 API 응답)
    if (moveTasks.length > 0) {
      Promise.all(moveTasks.map(async ({ fromPath, toPath }) => {
        try {
          await this.moveImage(fromPath, toPath);
          this.logger.log(`Moved image in background: ${fromPath} -> ${toPath}`);
        } catch (error) {
          this.logger.error(`Failed to move temp image in background: ${fromPath}`, error);
        }
      })).catch(err => {
        this.logger.error(`Background move tasks failed completely for ${targetFolder}`, err);
      });
    }

    return newContent;
  }
}
