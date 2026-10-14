import { Controller, Get, Post, Patch, Put, Delete, Param, Body, Query, Req, UseGuards, UsePipes, ParseUUIDPipe, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BoardsService } from './boards.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import {
  AddSubManagerZodDto,
  ChangeBoardManagerZodDto,
  CreateBoardRequestZodDto,
  CreateBoardZodDto,
  ReviewBoardRequestZodDto,
  UpdateBoardSettingsZodDto,
  UpdateBoardZodDto,
} from '../../common/dto/zod-dto';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ApiException } from '../../common/exceptions/api.exception';
import { ErrorCode } from '@community/shared-types';
import { BoardManagersService } from './board-managers.service';
import { BoardRequestsService } from './board-requests.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('boards')
@Controller('boards')
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
    private readonly boardRequestsService: BoardRequestsService,
    private readonly boardManagersService: BoardManagersService,
  ) {}

  // 게시판 정보는 서비스가 서버 메모리에 짧게(5초) 들고 있어 응답 캐시(Redis)를 따로 두지 않는다.
  // 두 겹으로 캐시하면 관리자가 바꾼 설정(비활성·비공개 등)이 사이드바에 늦게 반영됐다
  @Get()
  @ApiOperation({ summary: '게시판 목록 조회' })
  async getBoards() {
      return this.boardsService.findAll();
  }

  @Get('directory')
  @ApiOperation({ summary: '게시판 목록 페이지 (공개 게시판, 글 수, 매니저)' })
  async getDirectory(@Query('q') q?: string) {
      return this.boardsService.findDirectory(q);
  }

  // === 게시판 개설 신청 ===

  @Post('requests')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: '게시판 개설 신청 (회원)' })
  @ApiBody({ type: CreateBoardRequestZodDto })
  @UseGuards(AuthGuard('jwt'), UserStatusGuard)
  @UsePipes(new ZodValidationPipe(CreateBoardRequestZodDto))
  async createRequest(@Req() req: any, @Body() dto: CreateBoardRequestZodDto) {
      return this.boardRequestsService.create(req.user.id, dto);
  }

  @Get('requests/my')
  @UseGuards(AuthGuard('jwt'))
  async getMyRequests(@Req() req: any) {
      return this.boardRequestsService.findMine(req.user.id);
  }

  @Get('admin/requests')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async getRequests(@Query('status') status?: string, @Query('page') page = '1', @Query('limit') limit = '20') {
      return this.boardRequestsService.findAll(status, parseInt(page), parseInt(limit));
  }

  @Patch('admin/requests/:id')
  @ApiBody({ type: ReviewBoardRequestZodDto })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(ReviewBoardRequestZodDto))
  async reviewRequest(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Req() req: any,
      @Body() dto: ReviewBoardRequestZodDto,
  ) {
      return this.boardRequestsService.review(id, req.user.id, dto);
  }

  // === 게시판 관리자 (매니저/부매니저) ===

  @Get(':slug/managers')
  // 로그인은 필요 없지만, 로그인했으면 관리자 본인인지 알아야 하므로(관리자 표시를 끈 게시판) 토큰을 읽는다
  @UseGuards(JwtAuthGuard)
  @Public()
  async getManagers(@Param('slug') slug: string, @Req() req: any) {
      return this.boardManagersService.getManagers(slug, { userId: req.user?.id, role: req.user?.role });
  }

  @Post(':slug/sub-managers')
  @ApiBody({ type: AddSubManagerZodDto })
  @UseGuards(AuthGuard('jwt'), UserStatusGuard)
  @UsePipes(new ZodValidationPipe(AddSubManagerZodDto))
  async addSubManager(@Param('slug') slug: string, @Req() req: any, @Body() dto: AddSubManagerZodDto) {
      return this.boardManagersService.addSubManager(slug, { userId: req.user.id, role: req.user.role }, dto.name);
  }

  @Delete(':slug/sub-managers/:userId')
  @UseGuards(AuthGuard('jwt'), UserStatusGuard)
  async removeSubManager(
      @Param('slug') slug: string,
      @Param('userId', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) userId: string,
      @Req() req: any,
  ) {
      return this.boardManagersService.removeSubManager(slug, { userId: req.user.id, role: req.user.role }, userId);
  }

  @Patch(':slug/settings')
  @ApiBody({ type: UpdateBoardSettingsZodDto })
  @UseGuards(AuthGuard('jwt'), UserStatusGuard)
  @UsePipes(new ZodValidationPipe(UpdateBoardSettingsZodDto))
  async updateSettings(@Param('slug') slug: string, @Req() req: any, @Body() dto: UpdateBoardSettingsZodDto) {
      return this.boardManagersService.updateSettings(slug, { userId: req.user.id, role: req.user.role }, dto);
  }

  @Put('admin/:id/manager')
  @ApiOperation({ summary: '게시판 매니저 변경 (관리자)' })
  @ApiBody({ type: ChangeBoardManagerZodDto })
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(ChangeBoardManagerZodDto))
  async changeManager(
      @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.NOT_FOUND })) id: string,
      @Body() dto: ChangeBoardManagerZodDto,
  ) {
      return this.boardManagersService.changeManager(id, dto.name);
  }

  @Get(':slug')
  @ApiOperation({ summary: '게시판 상세 조회' })
  async getBoard(@Param('slug') slug: string) {
      const board = await this.boardsService.findBySlug(slug);
      // 없는 게시판이면 빈 200 대신 404 (화면이 없는 게시판을 알아챌 수 있게)
      if (!board) throw new ApiException(ErrorCode.BOARD_NOT_FOUND, HttpStatus.NOT_FOUND);
      return board;
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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
      await this.boardsService.delete(id);
      return { success: true };
  }
}
