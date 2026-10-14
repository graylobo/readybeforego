import {
  Controller,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Req,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ApiException } from '../../common/exceptions/api.exception';
import { UPLOAD_LIMITS, ErrorCode, isAdmin } from '@community/shared-types';

/**
 * 프론트엔드 업로드 요청에 허용하는 저장 폴더 목록
 * - 폴더는 사용자가 고르는 값이 아니라 화면 코드가 요청의 folder 필드에 지정하는 값이다.
 *   (예: 댓글 폼은 folder: 'comments' 로 요청)
 * - 요청을 직접 조작해 임의 폴더에 업로드하는 것을 막기 위해 이 목록 외의 값은 거부한다.
 * - 그 외 폴더(signatures 등)는 서버 내부 작업 전용이다.
 * - 파생 프로젝트에서 전용 폴더가 필요하면 이 목록에 추가한다.
 */
const CLIENT_UPLOAD_FOLDERS = ['temp', 'comments', 'profiles'];

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('images')
  // 익명 게시판의 비로그인 글쓰기에서도 이미지 첨부가 필요하므로 공개하되, 비로그인은 temp 폴더로 제한
  @UseGuards(JwtAuthGuard)
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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
      // 원본은 최적화 전 크기 기준으로만 막고, 최적화 후 10MB 검사는 서비스에서 한다
      fileSize: UPLOAD_LIMITS.IMAGE_INPUT_SIZE,
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
    @Req() req: any,
    @Body('folder') folder?: string,
    // 게시글 본문 이미지면 'true': 작은 버전을 함께 만들어 srcset을 돌려준다
    @Body('responsive') responsive?: string,
  ) {
    if (!file) {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.BAD_REQUEST, '파일이 없습니다.');
    }

    const userId: string | undefined = req.user?.id;
    const targetFolder = folder || 'temp';
    if (!CLIENT_UPLOAD_FOLDERS.includes(targetFolder)) {
      throw new ApiException(ErrorCode.INVALID_INPUT, HttpStatus.BAD_REQUEST, '허용되지 않는 업로드 경로입니다.');
    }
    if (!userId && targetFolder !== 'temp') {
      throw new ApiException(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, '로그인이 필요합니다.');
    }

    // 로그인 사용자의 파일은 {folder}/{userId}/ 하위에 저장하여 소유자를 경로로 식별한다
    const result = await this.uploadsService.uploadImage(
      file.buffer,
      file.mimetype,
      targetFolder,
      userId,
      { responsive: responsive === 'true' },
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
  async deleteImage(@Body('url') url: string, @Req() req: any) {
    if (!url) return { success: false };

    const path = this.uploadsService.extractPathFromUrl(url);
    if (!path) return { success: false, message: 'Invalid URL' };

    // 본인이 업로드한 파일({folder}/{userId}/...)만 삭제 가능. 관리자는 예외
    const [folder, ownerId] = path.split('/');
    const isOwner =
      CLIENT_UPLOAD_FOLDERS.includes(folder) && !!ownerId && ownerId === req.user?.id && !path.includes('..');
    if (!isOwner && !isAdmin(req.user?.role)) {
      throw new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, '이미지를 삭제할 권한이 없습니다.');
    }

    try {
      await this.uploadsService.deleteImage(path);
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }
}

