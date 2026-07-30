import { Module } from '@nestjs/common';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';
import { CountriesRepository } from './countries.repository';

@Module({
  controllers: [CountriesController],
  providers: [CountriesService, CountriesRepository],
  exports: [CountriesService, CountriesRepository],
})
export class CountriesModule {}
