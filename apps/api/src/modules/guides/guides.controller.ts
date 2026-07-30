import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { GuidesService } from './guides.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateGuideZodDto, UpdateGuideZodDto } from './dto/guides.dto';

@ApiTags('guides')
@Controller('guides')
export class GuidesController {
  constructor(private readonly guidesService: GuidesService) {}

  @Get('countries')
  @ApiOperation({ summary: '가이드 정보가 존재하는 국가 목록 조회' })
  async getAvailableCountries() {
    return this.guidesService.getAvailableCountries();
  }

  @Get('country/:countryCode')
  @ApiOperation({ summary: '특정 국가의 가이드 항목 목록 조회' })
  async getGuidesByCountry(
    @Param('countryCode') countryCode: string,
    @Query('includeCommon') includeCommon?: string,
  ) {
    const isIncludeCommon = includeCommon !== 'false';
    return this.guidesService.getGuidesByCountry(countryCode, isIncludeCommon);
  }

  // --- Admin Endpoints ---
  @Post('admin')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(CreateGuideZodDto))
  @ApiBody({ type: CreateGuideZodDto })
  @ApiOperation({ summary: '[어드민] 신규 가이드/준비물 항목 생성' })
  async createGuide(@Body() dto: CreateGuideZodDto) {
    return this.guidesService.createGuide(dto);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(UpdateGuideZodDto))
  @ApiBody({ type: UpdateGuideZodDto })
  @ApiOperation({ summary: '[어드민] 가이드/준비물 항목 수정' })
  async updateGuide(@Param('id') id: string, @Body() dto: UpdateGuideZodDto) {
    return this.guidesService.updateGuide(id, dto);
  }

  @Post('admin/bulk-delete')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '[어드민] 가이드/준비물 항목 다중 일괄 삭제' })
  async deleteGuides(@Body() body: { ids: string[] }) {
    return this.guidesService.deleteGuides(body.ids || []);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '[어드민] 가이드/준비물 항목 삭제' })
  async deleteGuide(@Param('id') id: string) {
    return this.guidesService.deleteGuide(id);
  }
}
