import { Injectable, NotFoundException } from '@nestjs/common';
import { ScamsRepository } from './scams.repository';
import { CreateScamInfoZodDto, UpdateScamInfoZodDto } from './dto/scams.dto';

@Injectable()
export class ScamsService {
  constructor(private readonly scamsRepository: ScamsRepository) {}

  async create(createDto: CreateScamInfoZodDto) {
    return this.scamsRepository.transaction(async (tx) => {
      let regionId = createDto.regionId;
      let cityId = createDto.cityId;

      // 1. cityId가 없는데 cityName과 국가 정보(countryCode 또는 countryName)가 제공된 경우 동적 국가 및 도시 생성 처리
      if (!regionId && !cityId && createDto.cityName && (createDto.countryCode || createDto.countryName)) {
        let country: any = null;

        // 1-1. countryCode가 제공되었다면 먼저 코드로 국가 검색
        if (createDto.countryCode) {
          country = await this.scamsRepository.findCountryByCode(createDto.countryCode, tx);
        }

        // 1-2. 그래도 국가가 없거나 countryName이 제공된 경우 이름으로 국가 검색/생성
        if (!country && createDto.countryName) {
          const countryName = createDto.countryName.trim();
          country = await this.scamsRepository.findCountryByName(countryName, tx);

          if (!country) {
            let code = (createDto.countryCode || countryName.substring(0, 2)).toUpperCase();
            
            // 국가 코드 유니크 제약 중복 충돌 방지 가드
            let existingCountryByCode = await this.scamsRepository.findCountryByCode(code, tx);
            let count = 1;
            while (existingCountryByCode) {
              code = (createDto.countryCode || countryName.substring(0, 2)).toUpperCase() + count;
              existingCountryByCode = await this.scamsRepository.findCountryByCode(code, tx);
              count++;
            }

            country = await this.scamsRepository.createCountry({
              code,
              name: countryName,
              nameEn: countryName,
            }, tx);
          }
        }

        // 1-3. 국가가 식별되었으면 도시 생성 진행
        if (country) {
          const cityName = createDto.cityName.trim();
          let city = await this.scamsRepository.findCityByName(cityName, country.code, tx);

          // 도시 정보가 존재하지 않으면 새로 동적 생성
          if (!city) {
            city = await this.scamsRepository.createCity({
              countryCode: country.code,
              name: cityName,
              nameEn: cityName,
              latitude: createDto.latitude ?? 0,
              longitude: createDto.longitude ?? 0,
            }, tx);
          }
          cityId = city.id;
        }
      }

      // 2. 세부 지역(Region) 생성 처리
      if (!regionId && createDto.regionName && cityId && createDto.latitude !== undefined && createDto.longitude !== undefined) {
        const newRegion = await this.scamsRepository.createRegion({
          cityId: cityId,
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

  async reverseGeocode(lat: number, lng: number) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=ko`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'readybeforego-travel-scam-agent/1.0',
          'Accept-Language': 'ko'
        }
      });
      if (!response.ok) {
        throw new Error('OSM Geocoding Error');
      }
      return await response.json();
    } catch (error) {
      console.error('Nominatim bypass error:', error);
      return { address: {} };
    }
  }
}
