import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UsePipes, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { BoardsService } from './boards.service';
import { ClearCacheInterceptor } from '../../common/interceptors/clear-cache.interceptor';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { CreateBoardZodDto, UpdateBoardZodDto } from '../../common/dto/zod-dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('boards')
@Controller('boards')
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
  ) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @ApiOperation({ summary: '게시판 목록 조회' })
  async getBoards() {
      return this.boardsService.findAll();
  }

  @Get(':slug')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60000)
  @ApiOperation({ summary: '게시판 상세 조회' })
  async getBoard(@Param('slug') slug: string) {
      return this.boardsService.findBySlug(slug);
  }

  // === Admin Endpoints ===

  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async findAllAdmin() {
      const boards = await this.boardsService.findAllAdmin();
      return { boards };
  }

  @Post('admin')
  @UseInterceptors(ClearCacheInterceptor('/boards*'))
  @ApiOperation({ summary: '게시판 생성 (관리자)' })
  @ApiBody({ type: CreateBoardZodDto })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(CreateBoardZodDto))
  async create(@Body() dto: CreateBoardZodDto) {
      const board = await this.boardsService.create(dto);
      return { board };
  }

  @Patch('admin/:id')
  @UseInterceptors(ClearCacheInterceptor('/boards*'))
  @ApiOperation({ summary: '게시판 수정 (관리자)' })
  @ApiBody({ type: UpdateBoardZodDto })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(UpdateBoardZodDto))
  async update(@Param('id') id: string, @Body() dto: UpdateBoardZodDto) {
      const board = await this.boardsService.update(id, dto);
      return { board };
  }

  @Delete('admin/:id')
  @UseInterceptors(ClearCacheInterceptor('/boards*'))
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
      await this.boardsService.delete(id);
      return { success: true };
  }
}
