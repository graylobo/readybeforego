import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateEmoticonPackZodDto, UpdateEmoticonPackStatusZodDto, UpdateEmoticonPackZodDto } from '../../common/dto/zod-dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EmoticonsService } from './emoticons.service';

@Controller('emoticons')
export class EmoticonsController {
  constructor(private readonly emoticonsService: EmoticonsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() createDto: CreateEmoticonPackZodDto) {
    return this.emoticonsService.create(req.user.id, createDto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Req() req: any, @Param('id') id: string, @Body() updateDto: UpdateEmoticonPackZodDto) {
    return this.emoticonsService.update(id, req.user.id, updateDto);
  }

  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('status') status: string,
    @Query('q') q: string,
    @Query('sortBy') sortBy: string,
  ) {
    return this.emoticonsService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
      q,
      sortBy as 'latest' | 'sales',
    );
  }

  @Get('my/created')
  @UseGuards(JwtAuthGuard)
  findMyCreatedPacks(
    @Req() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.emoticonsService.getMyCreatedPacks(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('my/purchased')
  @UseGuards(JwtAuthGuard)
  findMyPurchasedPacks(
    @Req() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
      // Return flat array of emulation items or list of packs? Let's return list of purchased packs and we can flatten it in frontend.
      return this.emoticonsService.getMyPacks(
        req.user.id,
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 100, // typically need all purchased
      );
  }

  @Get('by-url')
  findByUrl(@Query('url') url: string) {
    return this.emoticonsService.findByUrl(url);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emoticonsService.findOne(id);
  }

  @Post(':id/purchase')
  @UseGuards(JwtAuthGuard)
  purchase(@Req() req: any, @Param('id') id: string) {
    return this.emoticonsService.purchase(req.user.id, id);
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateEmoticonPackStatusZodDto,
  ) {
    return this.emoticonsService.updateStatus(id, updateDto);
  }

  @Put(':id/price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  updatePrice(
    @Param('id') id: string,
    @Body('price') price: number,
  ) {
    return this.emoticonsService.updatePrice(id, price);
  }

  @Delete(':id/force')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  forceRemove(@Param('id') id: string) {
    return this.emoticonsService.forceDeleteWithRefund(id);
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard)
  restore(@Req() req: any, @Param('id') id: string) {
    return this.emoticonsService.restore(id, req.user.id, req.user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.emoticonsService.remove(id, req.user.id, req.user.role);
  }
}
