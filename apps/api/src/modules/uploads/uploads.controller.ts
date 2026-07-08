import {
  Controller,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UPLOAD_LIMITS } from '@community/shared-types';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images')
  @ApiOperation({ summary: '이미지 업로드' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: '저장할 대상 폴더명 (기본값: temp)',
        }
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: UPLOAD_LIMITS.IMAGE_SIZE,
    },
    fileFilter: (req, file, callback) => {
      if (!UPLOAD_LIMITS.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        return callback(new Error('허용되지 않는 파일 형식입니다.'), false);
      }
      callback(null, true);
    }
  }))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string
  ) {
    if (!file) {
        throw new Error('파일이 없습니다.');
    }
    const result = await this.uploadsService.uploadImage(
      file.buffer,
      file.mimetype,
      folder || 'temp'
    );
    return {
        data: result,
    };
  }

  /**
   * 단일 파일 삭제 (URL 기반)
   * 댓글 이미지 첨부 교체 시 이전 이미지 정리에 사용
   */
  @Delete('images')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '이미지 삭제 (URL 기반)' })
  async deleteImage(@Body('url') url: string) {
    if (!url) return { success: false };

    try {
      const path = this.uploadsService.extractPathFromUrl(url);

      if (!path) return { success: false, message: 'Invalid URL' };

      await this.uploadsService.deleteImage(path);
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }
}

