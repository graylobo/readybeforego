import { Injectable, NotFoundException } from '@nestjs/common';
import { ScamsRepository } from './scams.repository';
import { CreateScamInfoZodDto, UpdateScamInfoZodDto } from './dto/scams.dto';

@Injectable()
export class ScamsService {
  constructor(private readonly scamsRepository: ScamsRepository) {}

  async create(createDto: CreateScamInfoZodDto) {
    return this.scamsRepository.transaction(async (tx) => {
      let regionId = createDto.regionId;

      if (!regionId && createDto.regionName && createDto.cityId && createDto.latitude !== undefined && createDto.longitude !== undefined) {
        const newRegion = await this.scamsRepository.createRegion({
          cityId: createDto.cityId,
          name: createDto.regionName,
          nameEn: createDto.regionName,
          latitude: createDto.latitude,
          longitude: createDto.longitude,
        }, tx);
        regionId = newRegion.id;
      }

      if (!regionId) {
        throw new Error('올바른 지역 정보가 지정되지 않았습니다.');
      }

      return this.scamsRepository.create({
        regionId: regionId,
        title: createDto.title,
        description: createDto.description,
        avoidanceTip: createDto.avoidanceTip ?? null,
        scamCategory: createDto.scamCategory,
        sourceUrl: createDto.sourceUrl ?? null,
        imageUrls: createDto.imageUrls ?? [],
      }, tx);
    });
  }

  async update(id: string, updateDto: UpdateScamInfoZodDto) {
    const scam = await this.scamsRepository.findById(id);
    if (!scam) {
      throw new NotFoundException('해당 사기 정보를 찾을 수 없습니다.');
    }
    return this.scamsRepository.update(id, updateDto);
  }

  async getScamById(id: string) {
    const scam = await this.scamsRepository.findById(id);
    if (!scam) {
      throw new NotFoundException('해당 사기 정보를 찾을 수 없습니다.');
    }
    return scam;
  }

  async getScamsByRegion(regionId: string, userId?: string, ipAddress?: string) {
    return this.scamsRepository.findByRegion(regionId, userId, ipAddress);
  }

  async getScamsByCity(cityId: string, userId?: string, ipAddress?: string) {
    return this.scamsRepository.findByCity(cityId, userId, ipAddress);
  }

  async getScamsByCountry(countryCode: string, userId?: string, ipAddress?: string) {
    return this.scamsRepository.findByCountry(countryCode, userId, ipAddress);
  }

  async toggleReaction(
    scamInfoId: string,
    type: 'like' | 'dislike',
    userId?: string,
    ipAddress?: string
  ) {
    const scam = await this.scamsRepository.findById(scamInfoId);
    if (!scam) {
      throw new NotFoundException('해당 사기 정보를 찾을 수 없습니다.');
    }

    return this.scamsRepository.transaction(async (tx) => {
      const existingReaction = await this.scamsRepository.findReaction(
        scamInfoId,
        userId,
        ipAddress,
        tx
      );

      if (existingReaction) {
        if (existingReaction.type === type) {
          await this.scamsRepository.deleteReaction(existingReaction.id, tx);
        } else {
          await this.scamsRepository.updateReaction(existingReaction.id, type, tx);
        }
      } else {
        await this.scamsRepository.addReaction(
          {
            scamInfoId,
            userId: userId ?? null,
            ipAddress: userId ? null : ipAddress,
            type,
          },
          tx
        );
      }

      await this.scamsRepository.recalculateReactionCounts(scamInfoId, tx);

      return this.scamsRepository.findById(scamInfoId, tx);
    });
  }

  async getCountries() {
    return this.scamsRepository.findAllCountries();
  }

  async getCities(countryCode: string) {
    return this.scamsRepository.findCitiesByCountry(countryCode);
  }

  async getRegions(cityId: string) {
    return this.scamsRepository.findRegionsByCity(cityId);
  }

  async getAllRegions() {
    return this.scamsRepository.findAllRegions();
  }
}
