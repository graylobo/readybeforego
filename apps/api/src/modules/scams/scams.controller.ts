import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards, UsePipes, Delete, Header } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { USER_ROLES } from '@community/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ScamsService } from './scams.service';
import { CreateScamInfoZodDto, SaveScamSightingZodDto, ToggleScamReactionZodDto, UpdateScamInfoZodDto } from './dto/scams.dto';

@ApiTags('scams')
@Controller('scams')
export class ScamsController {
  constructor(private readonly scamsService: ScamsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @ApiOperation({ summary: '사기 경고 정보 등록' })
  @UsePipes(new ZodValidationPipe(CreateScamInfoZodDto))
  @ApiBody({ type: CreateScamInfoZodDto })
  async create(
    @Body() createDto: CreateScamInfoZodDto,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    return this.scamsService.create(createDto, userId);
  }

  // --- Static Routes (Must be declared before wildcard routes to prevent masking) ---

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, UserStatusGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: '어드민용 사기 경고 정보 목록 조회 (페이징 & 검색)' })
  async getAdminScams(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('scope') scope?: string,
    @Query('countryCode') countryCode?: string,
    @Query('cityId') cityId?: string,
    @Query('scamCategory') scamCategory?: string,
  ) {
    return this.scamsService.getAdminScams({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      scope,
      countryCode,
      cityId,
      scamCategory,
    });
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, UserStatusGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: '어드민용 사기 경고 정보 삭제' })
  async deleteAdminScam(@Param('id') id: string) {
    return this.scamsService.deleteAdminScam(id);
  }

  @Patch('admin/:id/restore')
  @UseGuards(JwtAuthGuard, UserStatusGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: '어드민용 삭제된 사기 경고 정보 복구' })
  async restoreAdminScam(@Param('id') id: string) {
    return this.scamsService.restoreAdminScam(id);
  }

  @Post('admin/bulk-delete')
  @UseGuards(JwtAuthGuard, UserStatusGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: '어드민용 사기 경고 정보 다중 선택 일괄 삭제' })
  async deleteAdminScamsBulk(@Body('ids') ids: string[]) {
    return this.scamsService.deleteAdminScamsBulk(ids);
  }

  @Post('admin/bulk-import')
  @UseGuards(JwtAuthGuard, UserStatusGuard, RolesGuard)
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: '어드민용 JSON 데이터 기반 사기 경고 정보 일괄 등록' })
  async bulkImportAdminScams(@Body('items') items: any[]) {
    return this.scamsService.bulkImportAdminScams(items);
  }

  @Get('countries')
  @ApiOperation({ summary: '전체 국가 목록 조회' })
  async getCountries() {
    return this.scamsService.getCountries();
  }

  @Get('cities/:countryCode')
  @ApiOperation({ summary: '특정 국가의 도시 목록 조회' })
  async getCities(@Param('countryCode') countryCode: string) {
    return this.scamsService.getCities(countryCode);
  }

  @Get('regions/all')
  @ApiOperation({ summary: '전체 세부 지역 목록 조회 (지도 마커 로딩용)' })
  // 제보를 올린 직후 마커가 바로 늘어나도록 매번 변경 여부를 확인한다 (바뀌지 않았으면 ETag로 304 응답)
  @Header('Cache-Control', 'no-cache')
  async getAllRegions() {
    return this.scamsService.getAllRegions();
  }

  @Get('regions/:cityId')
  @ApiOperation({ summary: '특정 도시의 세부 지역 목록 조회' })
  async getRegions(@Param('cityId') cityId: string) {
    return this.scamsService.getRegions(cityId);
  }

  @Get('area-summaries')
  @Header('Cache-Control', 'no-cache')
  @ApiOperation({ summary: '도시·국가 전체 주의사항 건수 (장소가 없는 지역도 지도와 검색에 보여 주기 위함)' })
  async getAreaSummaries() {
    return this.scamsService.getAreaSummaries();
  }

  @Get('region/:regionId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '특정 지역의 사기 경고 정보 목록 조회' })
  async getByRegion(
    @Param('regionId') regionId: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.scamsService.getScamsByRegion(regionId, userId, ip as string);
  }

  @Get('city/:cityId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '특정 도시의 모든 사기 경고 정보 목록 조회' })
  async getByCity(
    @Param('cityId') cityId: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.scamsService.getScamsByCity(cityId, userId, ip as string);
  }

  @Get('country/:countryCode')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '특정 국가의 모든 사기 경고 정보 목록 조회' })
  async getByCountry(
    @Param('countryCode') countryCode: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.scamsService.getScamsByCountry(countryCode, userId, ip as string);
  }

  @Get('reverse-geocode')
  @ApiOperation({ summary: '위경도 좌표 기반 리버스 지오코딩 (OSM Nominatim 우회)' })
  async reverseGeocode(
    @Query('lat') lat: string,
    @Query('lng') lng: string
  ) {
    return this.scamsService.reverseGeocode(Number(lat), Number(lng));
  }

  @Get('search-address')
  @ApiOperation({ summary: '주소 기반 위치 검색 (OSM Nominatim 우회)' })
  async searchAddress(
    @Query('q') query: string
  ) {
    return this.scamsService.searchAddress(query);
  }

  // --- Dynamic Wildcard Routes (Must be declared at the bottom) ---

  @Get(':id')
  @ApiOperation({ summary: '사기 경고 정보 상세 조회' })
  async getById(@Param('id') id: string) {
    return this.scamsService.getScamById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @ApiOperation({ summary: '사기 경고 정보 수정' })
  @UsePipes(new ZodValidationPipe(UpdateScamInfoZodDto))
  @ApiBody({ type: UpdateScamInfoZodDto })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateScamInfoZodDto,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    return this.scamsService.update(id, updateDto, userId, userRole);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @ApiOperation({ summary: '사기 경고 정보 삭제' })
  async delete(
    @Param('id') id: string,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    return this.scamsService.delete(id, userId, userRole);
  }

  @Get(':id/sightings')
  @ApiOperation({ summary: '주의사항을 겪은 위치 목록 조회 (작성자 정보 없음)' })
  async getSightings(@Param('id') id: string) {
    return this.scamsService.getSightings(id);
  }

  @Post(':id/sightings')
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @ApiOperation({ summary: '내가 겪은 위치 기록 (주의사항당 1건, 다시 보내면 수정)' })
  @UsePipes(new ZodValidationPipe(SaveScamSightingZodDto))
  @ApiBody({ type: SaveScamSightingZodDto })
  async saveSighting(
    @Param('id') id: string,
    @Body() body: SaveScamSightingZodDto,
    @Req() req: any
  ) {
    return this.scamsService.saveSighting(id, req.user.id, body);
  }

  @Delete(':id/sightings')
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @ApiOperation({ summary: '내가 겪은 위치 기록 취소' })
  async deleteSighting(@Param('id') id: string, @Req() req: any) {
    return this.scamsService.deleteSighting(id, req.user.id);
  }

  @Post(':id/reaction')
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @ApiOperation({ summary: '사기 경고 정보에 대한 좋아요/싫어요 토글' })
  @UsePipes(new ZodValidationPipe(ToggleScamReactionZodDto))
  @ApiBody({ type: ToggleScamReactionZodDto })
  async toggleReaction(
    @Param('id') id: string,
    @Body() body: ToggleScamReactionZodDto,
    @Req() req: any
  ) {
    return this.scamsService.toggleReaction(id, body.type, req.user.id);
  }
}
