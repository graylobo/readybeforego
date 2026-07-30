import { Injectable, OnModuleInit } from '@nestjs/common';
import { CountriesRepository } from './countries.repository';
import { CreateCountryDto, UpdateCountryDto } from './dto/countries.dto';
import { getFlagEmoji, getKoreanCountryName } from '@community/shared-types';

@Injectable()
export class CountriesService implements OnModuleInit {
  constructor(private readonly countriesRepository: CountriesRepository) {}

  async onModuleInit() {
    try {
      const countries = await this.countriesRepository.findAll();
      for (const country of countries) {
        const correctEmoji = getFlagEmoji(country.code);
        const correctName = getKoreanCountryName(country.code);

        let updateNeeded = false;
        const updatePayload: Partial<CreateCountryDto> = {};

        if (country.emoji === '✈️' && correctEmoji !== '✈️') {
          updatePayload.emoji = correctEmoji;
          updateNeeded = true;
        }

        if ((!country.name || country.name === country.code) && correctName && correctName !== country.code) {
          updatePayload.name = correctName;
          updateNeeded = true;
        }

        if (updateNeeded) {
          await this.countriesRepository.update(country.code, updatePayload);
        }
      }
    } catch (err) {
      console.warn('[CountriesService] auto-heal error:', err);
    }
  }

  async getAllCountries(search?: string) {
    return this.countriesRepository.findAll(search);
  }

  async getCountryByCode(code: string) {
    return this.countriesRepository.findOne(code);
  }

  async createCountry(dto: CreateCountryDto) {
    return this.countriesRepository.create(dto);
  }

  async updateCountry(code: string, dto: UpdateCountryDto) {
    return this.countriesRepository.update(code, dto);
  }

  async deleteCountry(code: string) {
    return this.countriesRepository.delete(code);
  }
}
