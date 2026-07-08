import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserStatusGuard } from '../../common/guards/user-status.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ScamsService } from './scams.service';
import { CreateScamInfoZodDto, ToggleScamReactionZodDto, UpdateScamInfoZodDto } from './dto/scams.dto';

@ApiTags('scams')
@Controller('scams')
export class ScamsController {
  constructor(private readonly scamsService: ScamsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, UserStatusGuard)
  @ApiOperation({ summary: '사기 경고 정보 등록' })
  @UsePipes(new ZodValidationPipe(CreateScamInfoZodDto))
  @ApiBody({ type: CreateScamInfoZodDto })
  async create(@Body() createDto: CreateScamInfoZodDto) {
    return this.scamsService.create(createDto);
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
    @Body() updateDto: UpdateScamInfoZodDto
  ) {
    return this.scamsService.update(id, updateDto);
  }

  @Post(':id/reaction')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '사기 경고 정보에 대한 좋아요/싫어요 토글' })
  @UsePipes(new ZodValidationPipe(ToggleScamReactionZodDto))
  @ApiBody({ type: ToggleScamReactionZodDto })
  async toggleReaction(
    @Param('id') id: string,
    @Body() body: ToggleScamReactionZodDto,
    @Req() req: any
  ) {
    const userId = req.user?.id;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    return this.scamsService.toggleReaction(id, body.type, userId, ip as string);
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
  async getAllRegions() {
    return this.scamsService.getAllRegions();
  }

  @Get('regions/:cityId')
  @ApiOperation({ summary: '특정 도시의 세부 지역 목록 조회' })
  async getRegions(@Param('cityId') cityId: string) {
    return this.scamsService.getRegions(cityId);
  }
}
