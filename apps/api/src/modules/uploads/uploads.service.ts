import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import type { ImageUploadResult, StorageProvider, UploadResult } from './interfaces/storage-provider.interface';
import {
  UPLOAD_LIMITS,
  IMAGE_PROCESSING,
  COMMENT_IMAGE_THUMBNAIL_WIDTH,
  imageVariantPath,
  isCommentImagePath,
} from '@community/shared-types';

/** 본문 이미지 작은 버전 너비 (원본보다 작은 것만 만든다) */
const IMAGE_RESPONSIVE_WIDTHS = [720, 1280];

/** 댓글 이미지는 화면이 원본 주소에서 작은 버전 주소(-w440)를 바로 만들어 쓰므로, 원본 크기와 상관없이 항상 만든다 */
const COMMENT_FOLDER = 'comments';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject('STORAGE_PROVIDER')
    private readonly storageProvider: StorageProvider,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 이미지 업로드 (WebP로 최적화해 저장)
   */
  async uploadImage(
    fileData: Buffer,
    mimeType: string,
    folder: string = 'temp',
    userId?: string,
    options: { responsive?: boolean } = {},
  ): Promise<ImageUploadResult> {
    const withThumbnail = folder === COMMENT_FOLDER;
    // 원본 크기 검증. 저장 크기(10MB)는 최적화한 뒤에 검사한다 (큰 GIF도 WebP로 바꾸면 크게 줄어듦)
    if (fileData.length > UPLOAD_LIMITS.IMAGE_INPUT_SIZE) {
      throw new BadRequestException(
        `파일 크기가 너무 큽니다. (원본 최대 ${UPLOAD_LIMITS.IMAGE_INPUT_SIZE / 1024 / 1024}MB)`,
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

    // 업로드할 때 한 번에 최적화한다 (최대 너비로 줄이고 IMAGE_PROCESSING.QUALITY로 WebP 압축).
    // 예전에는 먼저 품질 90으로 저장한 뒤 백그라운드에서 다시 압축했는데, 백그라운드 단계가 "이미 WebP면 건너뛰기"라
    // 품질 90 결과를 보고 거의 항상 건너뛰어 압축되지 않았고(같은 이미지가 2~3배 큼), 글 저장 시 파일이 옮겨지면
    // 옛 위치에 덮어쓰는 문제도 있었다. 첫 변환도 원래 한 번 하던 작업이라 업로드 시간은 거의 같다.
    let outputBuffer = fileData;
    let isAnimated = false;
    try {
      const isAnimatedInput = mimeType === 'image/gif' || mimeType === 'image/webp';
      const image = sharp(fileData, { animated: isAnimatedInput });
      const metadata = await image.metadata();
      isAnimated = (metadata.pages ?? 1) > 1;
      const width = metadata.width ?? 0;
      // 움직이는 WebP는 다시 압축하면 화질이 떨어지거나 오히려 커지기 쉬워, 너비가 기준 이내면 그대로 둔다
      const keepAsIs = isAnimated && metadata.format === 'webp' && width <= IMAGE_PROCESSING.MAX_WIDTH;
      if (!keepAsIs) {
        const pipeline =
          width > IMAGE_PROCESSING.MAX_WIDTH
            ? image.resize({ width: IMAGE_PROCESSING.MAX_WIDTH, withoutEnlargement: true, fit: 'inside' })
            : image;
        outputBuffer = await pipeline.webp({ quality: IMAGE_PROCESSING.QUALITY }).toBuffer();
      }
    } catch (error) {
      this.logger.error('Image conversion failed', error);
    }

    // 최적화한 결과(변환에 실패했으면 원본)가 저장 한도를 넘으면 거절
    if (outputBuffer.length > UPLOAD_LIMITS.IMAGE_SIZE) {
      throw new BadRequestException(
        `최적화한 뒤에도 파일이 너무 큽니다. (${(outputBuffer.length / 1024 / 1024).toFixed(1)}MB, 최대 ${UPLOAD_LIMITS.IMAGE_SIZE / 1024 / 1024}MB)`,
      );
    }

    const size = await this.readImageSize(outputBuffer);

    // 본문 이미지는 작은 버전(720/1280px)을 함께 저장해 srcset으로 화면에 맞는 크기를 받게 한다.
    // 같은 폴더에 같은 이름 + -w{너비} 로 저장하므로, 글 저장 시 temp→posts 이동/주소 치환/고아 정리가
    // 본문 안의 주소를 찾아 처리하는 기존 로직으로 함께 처리된다. 움직이는 이미지는 만들지 않는다.
    const variantWidths =
      options.responsive && !isAnimated && size
        ? IMAGE_RESPONSIVE_WIDTHS.filter((w) => w < size.width)
        : [];
    const [main, thumbnail, ...variants] = await Promise.all([
      this.storageProvider.upload(outputBuffer, filePath, 'image/webp'),
      withThumbnail ? this.uploadCommentThumbnail(outputBuffer, filePath, isAnimated, size?.width) : null,
      ...variantWidths.map(async (w) => {
        const buffer = await sharp(outputBuffer).resize({ width: w }).webp({ quality: IMAGE_PROCESSING.QUALITY }).toBuffer();
        return this.storageProvider.upload(buffer, imageVariantPath(filePath, w), 'image/webp');
      }),
    ]);

    return {
      ...main,
      width: size?.width,
      height: size?.height,
      srcset: variants.length > 0 && size
        ? [...variants.map((v, i) => `${v.url} ${variantWidths[i]}w`), `${main.url} ${size.width}w`].join(', ')
        : undefined,
      variantPaths: [...variants, ...(thumbnail ? [thumbnail] : [])].map((v) => v.path),
    };
  }

  /** 댓글 이미지 작은 버전. 움직이는 이미지도 프레임째 줄인다 (원본이 이미 작으면 같은 파일을 그 이름으로 저장) */
  private async uploadCommentThumbnail(buffer: Buffer, filePath: string, isAnimated: boolean, width?: number) {
    let thumbnail = buffer;
    if (width && width > COMMENT_IMAGE_THUMBNAIL_WIDTH) {
      try {
        thumbnail = await sharp(buffer, { animated: isAnimated })
          .resize({ width: COMMENT_IMAGE_THUMBNAIL_WIDTH })
          .webp({ quality: IMAGE_PROCESSING.QUALITY })
          .toBuffer();
      } catch (error) {
        this.logger.error('Comment thumbnail conversion failed', error);
      }
    }
    return this.storageProvider.upload(thumbnail, imageVariantPath(filePath, COMMENT_IMAGE_THUMBNAIL_WIDTH), 'image/webp');
  }

  private async readImageSize(buffer: Buffer): Promise<{ width: number; height: number } | null> {
    try {
      const meta = await sharp(buffer, { animated: true }).metadata();
      const height = meta.pageHeight ?? meta.height;
      return meta.width && height ? { width: meta.width, height } : null;
    } catch {
      return null;
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

  /** 댓글 이미지면 함께 저장한 작은 버전도 지운다 (본문 이미지의 작은 버전은 본문에 주소가 있어 따로 지워진다) */
  async deleteImage(path: string): Promise<void> {
    await Promise.all([
      this.storageProvider.delete(path),
      ...(isCommentImagePath(path)
        ? [this.storageProvider.delete(imageVariantPath(path, COMMENT_IMAGE_THUMBNAIL_WIDTH))]
        : []),
    ]);
  }

  async deleteDirectory(path: string): Promise<void> {
    if (this.storageProvider.deleteDirectory) {
        return this.storageProvider.deleteDirectory(path);
    }
  }

  extractPathFromUrl(url: string): string | null {
    return this.storageProvider.extractPathFromUrl(url);
  }

  /** 댓글 첨부 이미지의 저장소 경로. 댓글 이미지 폴더(comments/)의 파일이 아니면 null (다른 파일을 지우지 않도록) */
  extractCommentImagePath(url: string | null | undefined): string | null {
    const path = url ? this.extractPathFromUrl(url) : null;
    return path && path.startsWith(`${COMMENT_FOLDER}/`) && !path.includes('..') ? path : null;
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
