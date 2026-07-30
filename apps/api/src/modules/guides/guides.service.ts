import { Injectable } from '@nestjs/common';
import { GuidesRepository } from './guides.repository';
import { CreateGuideZodDto, UpdateGuideZodDto } from './dto/guides.dto';

@Injectable()
export class GuidesService {
  constructor(private readonly guidesRepository: GuidesRepository) {}

  async getGuidesByCountry(countryCode: string, includeCommon: boolean = true) {
    const code = countryCode.toUpperCase();
    if (code === 'ALL_TOTAL' || code === 'ALL_COUNTRIES') {
      return this.guidesRepository.findAll();
    }
    return this.guidesRepository.findByCountry(code, includeCommon);
  }

  async getAvailableCountries() {
    return this.guidesRepository.findAvailableCountries();
  }

  async createGuide(data: CreateGuideZodDto) {
    return this.guidesRepository.createGuide({
      ...data,
      countryCode: data.countryCode.toUpperCase(),
    });
  }

  async updateGuide(id: string, data: UpdateGuideZodDto) {
    return this.guidesRepository.updateGuide(id, {
      ...data,
      countryCode: data.countryCode ? data.countryCode.toUpperCase() : undefined,
    });
  }

  async deleteGuide(id: string) {
    return this.guidesRepository.deleteGuide(id);
  }

  async deleteGuides(ids: string[]) {
    return this.guidesRepository.deleteGuides(ids);
  }
}
