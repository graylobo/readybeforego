import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { StorageProvider, UploadResult } from '../interfaces/storage-provider.interface';
import { SUPABASE_CLIENT } from './supabase.provider';

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  private readonly logger = new Logger(SupabaseStorageProvider.name);
  private readonly bucketName: string;

  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {
    this.bucketName = this.configService.get<string>('SUPABASE_BUCKET') || 'images';
  }

  async upload(file: Buffer, filePath: string, mimeType: string): Promise<UploadResult> {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      this.logger.error('Supabase upload error:', error);
      throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(data.path);

    return {
      url: publicUrl,
      path: data.path,
    };
  }

  async delete(filePath: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .remove([filePath]);

    if (error) {
      this.logger.error('Supabase delete error:', error);
      throw new Error(`Failed to delete file from Supabase: ${error.message}`);
    }
  }

  async move(fromPath: string, toPath: string): Promise<UploadResult> {
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .move(fromPath, toPath);

    if (error) {
      this.logger.error('Supabase move error:', error);
      throw new Error(`Failed to move file in Supabase: ${error.message}`);
    }

    const { data: { publicUrl } } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(toPath);

    return {
      url: publicUrl,
      path: toPath,
    };
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    const { data: files, error } = await this.supabase.storage
      .from(this.bucketName)
      .list(dirPath);

    if (error) {
      this.logger.error('Supabase list error for deleteDirectory:', error);
      return;
    }

    if (files && files.length > 0) {
      const filesToDelete = files.map((file: any) => `${dirPath}/${file.name}`);
      const { error: deleteError } = await this.supabase.storage
        .from(this.bucketName)
        .remove(filesToDelete);

      if (deleteError) {
        this.logger.error('Supabase delete error in deleteDirectory:', deleteError);
      }
    }
  }

  extractPathFromUrl(url: string): string | null {
    const pathMatch = url.match(/\/object\/(?:public|authenticated)\/[^/]+\/(.+)$/);
    return pathMatch ? pathMatch[1] : null;
  }

  async cleanupTempFiles(olderThan: Date): Promise<void> {
    const filesToDelete: string[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: files, error } = await this.supabase.storage
        .from(this.bucketName)
        .list('temp', {
          limit,
          offset,
        });

      if (error) {
        this.logger.error('Failed to list files in temp:', error);
        break;
      }

      if (!files || files.length === 0) {
        break;
      }

      for (const file of files) {
        // 폴더인 경우 (id가 null) 재귀적으로 처리 (한 단계만 처리)
        if (!file.id) {
           const userId = file.name;
           const { data: userFiles, error: userFilesError } = await this.supabase.storage
             .from(this.bucketName)
             .list(`temp/${userId}`, { limit: 1000, offset: 0 });
           
           if (userFilesError || !userFiles) continue;

           for (const userFile of userFiles) {
             const createdAt = new Date(userFile.created_at);
             if (createdAt < olderThan) {
               filesToDelete.push(`temp/${userId}/${userFile.name}`);
             }
           }
        } else {
           const createdAt = new Date(file.created_at);
           if (createdAt < olderThan) {
             filesToDelete.push(`temp/${file.name}`);
           }
        }
      }

      if (files.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    if (filesToDelete.length > 0) {
      const chunkSize = 100;
      this.logger.log(`Deleting ${filesToDelete.length} orphan files...`);
      let deletedCount = 0;

      for (let i = 0; i < filesToDelete.length; i += chunkSize) {
        const chunk = filesToDelete.slice(i, i + chunkSize);
        const { error: deleteError } = await this.supabase.storage
          .from(this.bucketName)
          .remove(chunk);

        if (deleteError) {
          this.logger.error('Failed to delete some files from chunk:', deleteError);
        } else {
          deletedCount += chunk.length;
        }
      }
      
      this.logger.log(`Cleanup completed. Deleted ${deletedCount} files.`);
    } else {
      this.logger.log('No files to cleanup.');
    }
  }
}
