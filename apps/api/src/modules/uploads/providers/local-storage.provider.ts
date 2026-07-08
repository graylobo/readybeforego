import { StorageProvider, UploadResult } from '../interfaces/storage-provider.interface';
import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

  constructor(private readonly configService: ConfigService) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(file: Buffer, filePath: string, mimeType: string): Promise<UploadResult> {
    const fullPath = path.join(this.uploadDir, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, file);

    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:4000';
    const url = `${apiUrl}/uploads/${filePath}`;

    return {
      url,
      path: filePath,
    };
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  async move(fromPath: string, toPath: string): Promise<UploadResult> {
    const fullFromPath = path.join(this.uploadDir, fromPath);
    const fullToPath = path.join(this.uploadDir, toPath);
    const dir = path.dirname(fullToPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(fullFromPath)) {
      fs.renameSync(fullFromPath, fullToPath);
    }

    const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:4000';
    const url = `${apiUrl}/uploads/${toPath}`;

    return {
      url: `${apiUrl}/uploads/${toPath}`,
      path: toPath,
    };
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, dirPath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  }

  extractPathFromUrl(url: string): string | null {
    const pathMatch = url.match(/\/uploads\/(.+)$/);
    return pathMatch ? pathMatch[1] : null;
  }

  async cleanupTempFiles(olderThan: Date): Promise<void> {
    const tempDir = path.join(this.uploadDir, 'temp');
    this.deleteOldFilesDFS(tempDir, olderThan);
  }

  private deleteOldFilesDFS(dir: string, olderThan: Date): void {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.deleteOldFilesDFS(fullPath, olderThan);
        // 빈 폴더 삭제
        const remaining = fs.readdirSync(fullPath);
        if (remaining.length === 0) {
          fs.rmdirSync(fullPath);
        }
      } else {
        if (stat.mtime < olderThan) {
          fs.unlinkSync(fullPath);
        }
      }
    }
  }
}

