import { Controller, Delete, HttpStatus, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PostsService } from './posts.service';

/**
 * 게시판을 글·댓글까지 통째로 삭제 (관리자). 글을 지우는 일이라 게시판 모듈이 아닌 게시글 모듈에 둔다
 * (게시판 모듈이 게시글 모듈을 알면 서로를 참조하게 됨)
 */
@ApiTags('boards')
@Controller('boards')
export class BoardPurgeController {
  constructor(private readonly postsService: PostsService) {}

  @Delete('admin/:id/with-posts')
  @ApiOperation({ summary: '게시판을 글까지 함께 삭제 (관리자)' })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async deleteWithPosts(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string) {
    return this.postsService.deleteBoardWithPosts(id);
  }
}
