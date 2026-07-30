import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { CountriesService } from './countries.service';
import { CreateCountryDto, UpdateCountryDto } from './dto/countries.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  async getAllCountries(@Query('search') search?: string) {
    return this.countriesService.getAllCountries(search);
  }

  @Get(':code')
  async getCountryByCode(@Param('code') code: string) {
    return this.countriesService.getCountryByCode(code);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createCountry(@Body() dto: CreateCountryDto) {
    return this.countriesService.createCountry(dto);
  }

  @Patch(':code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateCountry(
    @Param('code') code: string,
    @Body() dto: UpdateCountryDto,
  ) {
    return this.countriesService.updateCountry(code, dto);
  }

  @Delete(':code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deleteCountry(@Param('code') code: string) {
    return this.countriesService.deleteCountry(code);
  }
}
