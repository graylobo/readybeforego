import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { ScamsRepository } from './scams.repository';
import { getKoreanCountryName } from '@community/shared-types';
import { CreateScamInfoZodDto, UpdateScamInfoZodDto } from './dto/scams.dto';
import { UploadsService } from '../uploads/uploads.service';

// 1. 프론트엔드 호환용 표준 가상 주소 응답 모델 정의 🗺️
export interface GeocodeResponse {
  place_id: string | number;
  name: string;
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city: string;
    country: string;
    country_code: string;
  };
  lat: string;
  lon: string;
}

// 2. 지오코딩 제공자 추상 인터페이스 정의 🌍
export interface GeocodingProvider {
  reverseGeocode(lat: number, lng: number): Promise<GeocodeResponse>;
  searchAddress(query: string): Promise<GeocodeResponse[]>;
}

function formatExternalUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  let trimmed = url.trim();
  if (!trimmed) return null;

  // 1. 마크다운 링크 패턴 [text](https://...) 또는 [https://...](https://...) 정제
  const markdownMatch = trimmed.match(/\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
  if (markdownMatch && markdownMatch[1]) {
    trimmed = markdownMatch[1];
  } else {
    trimmed = trimmed.replace(/^\[+/, '').replace(/\]+$/, '');
  }

  const isHttp = /^http:\/\//i.test(trimmed);

  // 2. 모든 프로토콜 접두사 및 중복 기호(e.g., "https://://://", "https:/", "http://https://", "https:") 완전히 제거
  trimmed = trimmed.replace(/^(https?|http)[\s::/\\=]+/gi, '');

  if (!trimmed) return null;

  // 3. 단 하나의 올바른 프로토콜 접두사 재결합 (Idempotent 100% 보장)
  return isHttp ? `http://${trimmed}` : `https://${trimmed}`;
}

// 3. Nominatim(OSM) 지오코딩 제공자 구현 🔴
export class NominatimProvider implements GeocodingProvider {
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResponse> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=ko`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'readybeforego-travel-scam-agent/1.0',
        'Accept-Language': 'ko'
      }
    });
    if (!response.ok) {
      throw new Error('OSM Geocoding Error');
    }
    const data = await response.json();
    const addr = data.address || {};
    const countryCodeVal = (addr.country_code || "ETC").toUpperCase();

    // 한국은 시/군 레벨, 해외는 province/state 레벨을 대표 도시로 적용 🛡️
    const city = countryCodeVal === "KR"
      ? (addr.city || addr.county || addr.municipality || addr.province || "기타 도시")
      : (addr.province || addr.state || addr.city || "기타 도시");

    return {
      place_id: data.place_id,
      name: data.name || "",
      display_name: data.display_name || "",
      address: {
        road: addr.road,
        house_number: addr.house_number,
        suburb: addr.suburb,
        city: city,
        country: addr.country || "기타 국가",
        country_code: (addr.country_code || "etc").toLowerCase()
      },
      lat: String(data.lat || lat),
      lon: String(data.lon || lng)
    };
  }

  async searchAddress(query: string): Promise<GeocodeResponse[]> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=5&accept-language=ko`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'readybeforego-travel-scam-agent/1.0',
        'Accept-Language': 'ko'
      }
    });
    if (!response.ok) {
      throw new Error('OSM Search Error');
    }
    const results = await response.json();
    return results.map((data: any) => {
      const addr = data.address || {};
      const countryCodeVal = (addr.country_code || "ETC").toUpperCase();
      const city = countryCodeVal === "KR"
        ? (addr.city || addr.county || addr.municipality || addr.province || "기타 도시")
        : (addr.province || addr.state || addr.city || "기타 도시");

      return {
        place_id: data.place_id,
        name: data.name || "",
        display_name: data.display_name || "",
        address: {
          road: addr.road,
          house_number: addr.house_number,
          suburb: addr.suburb,
          city: city,
          country: addr.country || "기타 국가",
          country_code: (addr.country_code || "etc").toLowerCase()
        },
        lat: String(data.lat),
        lon: String(data.lon)
      };
    });
  }
}

// 4. Mapbox 지오코딩 제공자 구현 (추후 활성화용 뼈대 및 가동 준비 완료 🟢)
export class MapboxProvider implements GeocodingProvider {
  private readonly apiKey = process.env.MAPBOX_API_KEY || '';

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResponse> {
    if (!this.apiKey) {
      console.warn("Mapbox API Key가 설정되지 않았습니다. Nominatim으로 폴백 작동합니다.");
      return new NominatimProvider().reverseGeocode(lat, lng);
    }
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${this.apiKey}&language=ko`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Mapbox Geocoding Error');
    }
    const data = await response.json();
    const features = data.features || [];
    if (features.length === 0) {
      return {
        place_id: "mapbox_empty",
        name: "",
        display_name: "주소를 찾을 수 없습니다.",
        address: { city: "기타 도시", country: "기타 국가", country_code: "etc" },
        lat: String(lat),
        lon: String(lng)
      };
    }

    const mainFeature = features[0];
    const context = mainFeature.context || [];
    const countryObj = context.find((c: any) => c.id.startsWith('country'));
    const regionObj = context.find((c: any) => c.id.startsWith('region'));
    const placeObj = context.find((c: any) => c.id.startsWith('place'));
    const localityObj = context.find((c: any) => c.id.startsWith('locality'));

    const country = countryObj?.text || "기타 국가";
    const countryCode = (countryObj?.short_code || "etc").toLowerCase();
    
    // 한국은 시/군 레벨, 해외는 province 레벨 적용
    const city = countryCode.toUpperCase() === "KR"
      ? (placeObj?.text || regionObj?.text || "기타 도시")
      : (regionObj?.text || placeObj?.text || "기타 도시");

    return {
      place_id: mainFeature.id,
      name: mainFeature.text || "",
      display_name: mainFeature.place_name || "",
      address: {
        road: mainFeature.properties?.address || "",
        house_number: mainFeature.address || "",
        suburb: localityObj?.text || "",
        city: city,
        country: country,
        country_code: countryCode
      },
      lat: String(mainFeature.center?.[1] || lat),
      lon: String(mainFeature.center?.[0] || lng)
    };
  }

  async searchAddress(query: string): Promise<GeocodeResponse[]> {
    if (!this.apiKey) {
      return new NominatimProvider().searchAddress(query);
    }
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.apiKey}&language=ko&limit=5`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Mapbox Search Error');
    }
    const data = await response.json();
    const features = data.features || [];

    return features.map((feature: any) => {
      const context = feature.context || [];
      const countryObj = context.find((c: any) => c.id.startsWith('country'));
      const regionObj = context.find((c: any) => c.id.startsWith('region'));
      const placeObj = context.find((c: any) => c.id.startsWith('place'));
      const localityObj = context.find((c: any) => c.id.startsWith('locality'));

      const country = countryObj?.text || "기타 국가";
      const countryCode = (countryObj?.short_code || "etc").toLowerCase();
      
      const city = countryCode.toUpperCase() === "KR"
        ? (placeObj?.text || regionObj?.text || "기타 도시")
        : (regionObj?.text || placeObj?.text || "기타 도시");

      return {
        place_id: feature.id,
        name: feature.text || "",
        display_name: feature.place_name || "",
        address: {
          road: feature.properties?.address || "",
          house_number: feature.address || "",
          suburb: localityObj?.text || "",
          city: city,
          country: country,
          country_code: countryCode
        },
        lat: String(feature.center?.[1] || 0),
        lon: String(feature.center?.[0] || 0)
      };
    });
  }
}

@Injectable()
export class ScamsService {
  private readonly logger = new Logger(ScamsService.name);
  private readonly geocodingProvider: GeocodingProvider;

  constructor(
    private readonly scamsRepository: ScamsRepository,
    private readonly uploadsService: UploadsService,
  ) {
    // 💡 환경변수 'GEOCODING_PROVIDER' 변경만으로 1초 만에 맵 모듈을 스위칭 가능!
    const providerType = process.env.GEOCODING_PROVIDER || 'NOMINATIM';
    if (providerType.toUpperCase() === 'MAPBOX') {
      this.geocodingProvider = new MapboxProvider();
    } else {
      this.geocodingProvider = new NominatimProvider();
    }
  }

  async create(createDto: CreateScamInfoZodDto, userId?: string) {
    return this.scamsRepository.transaction(async (tx) => {
      let regionId: string | null = createDto.regionId ?? null;
      let cityId: string | null = createDto.cityId ?? null;
      let countryCode: string | null = createDto.countryCode ?? null;
      const scope = createDto.scope ?? 'spot';

      // 기존 ID가 존재하는 경우 상위 계층 구조(도시 및 국가) 역추적하여 매핑
      if (regionId) {
        const regionObj = await this.scamsRepository.findRegionById(regionId, tx);
        if (regionObj) {
          cityId = regionObj.cityId;
          if (cityId) {
            const cityObj = await this.scamsRepository.findCityById(cityId, tx);
            if (cityObj) {
              countryCode = cityObj.countryCode;
            }
          }
        }
      } else if (cityId) {
        const cityObj = await this.scamsRepository.findCityById(cityId, tx);
        if (cityObj) {
          countryCode = cityObj.countryCode;
        }
      }

      // 1. cityId가 없는데 cityName과 국가 정보가 제공된 경우 동적 국가 및 도시 생성 처리
      if (!regionId && !cityId && createDto.cityName && (createDto.countryCode || createDto.countryName)) {
        let country: any = null;

        // [보안 가드 🛡️] 사용자가 보낸 날것의 문자열 대신, 위경도 좌표를 백엔드에서 직접 역지오코딩하여 지명 강제 검증 및 정화
        let verifiedCountryCode = createDto.countryCode;
        let verifiedCountryName = createDto.countryName;
        let verifiedCityName = createDto.cityName;

        if (createDto.latitude !== undefined && createDto.longitude !== undefined) {
          try {
            const geoData = await this.reverseGeocode(createDto.latitude, createDto.longitude);
            if (geoData && geoData.address) {
              const addr = geoData.address;
              verifiedCountryName = addr.country || '기타 국가';
              verifiedCountryCode = (addr.country_code || 'ETC').toUpperCase();
              verifiedCityName = addr.city; // 👈 정제 매핑된 어댑터 필드를 다이렉트로 매핑!
            }
          } catch (e) {
            // 외부 지오코딩 실패 시 안전한 공통 기타 명칭으로 폴백
            verifiedCountryCode = verifiedCountryCode || 'ETC';
            verifiedCountryName = verifiedCountryName || '기타 국가';
            verifiedCityName = verifiedCityName || '기타 도시';
          }
        }

        // 1-1. 검증된 countryCode가 제공되었다면 코드로 국가 검색
        if (verifiedCountryCode) {
          country = await this.scamsRepository.findCountryByCode(verifiedCountryCode, tx);
        }

        // 1-2. 그래도 국가가 없거나 countryName이 제공된 경우 이름으로 국가 검색/생성
        if (!country && verifiedCountryName) {
          const countryName = verifiedCountryName.trim();
          country = await this.scamsRepository.findCountryByName(countryName, tx);

          if (!country) {
            let code = (verifiedCountryCode || countryName.substring(0, 2)).toUpperCase();
            
            // 국가 코드 유니크 제약 중복 충돌 방지 가드
            let existingCountryByCode = await this.scamsRepository.findCountryByCode(code, tx);
            let count = 1;
            while (existingCountryByCode) {
              code = (verifiedCountryCode || countryName.substring(0, 2)).toUpperCase() + count;
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

        if (country) {
          countryCode = country.code;
        }

        // 1-3. 국가가 식별되었으면 도시 생성 진행
        if (country && verifiedCityName) {
          const cityName = verifiedCityName.trim();
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

      // 2. 세부 지역(Region) 생성 처리 (Spot 및 Region 범위일 때만 지역 정보 생성)
      if ((scope === 'spot' || scope === 'region') && !regionId && createDto.regionName && cityId && createDto.latitude !== undefined && createDto.longitude !== undefined) {
        const newRegion = await this.scamsRepository.createRegion({
          cityId: cityId,
          name: createDto.regionName,
          nameEn: createDto.regionName,
          latitude: createDto.latitude,
          longitude: createDto.longitude,
        }, tx);
        regionId = newRegion.id;
      }

      // 3. 제보 적용 범위(Scope)에 맞춰 최종 저장할 계층 정보 정제
      let finalRegionId: string | null = null;
      let finalCityId: string | null = null;
      let finalCountryCode: string | null = null;

      if (scope === 'spot' || scope === 'region') {
        if (!regionId) {
          throw new Error('올바른 지역 정보가 지정되지 않았습니다.');
        }
        finalRegionId = regionId;
        finalCityId = cityId;
        finalCountryCode = countryCode;
      } else if (scope === 'city') {
        if (!cityId) {
          throw new Error('올바른 도시 정보가 지정되지 않았습니다.');
        }
        finalRegionId = null;
        finalCityId = cityId;
        finalCountryCode = countryCode;
      } else if (scope === 'country') {
        if (!countryCode) {
          throw new Error('올바른 국가 정보가 지정되지 않았습니다.');
        }
        finalRegionId = null;
        finalCityId = null;
        finalCountryCode = countryCode;
      }

      return this.scamsRepository.create({
        regionId: finalRegionId,
        cityId: finalCityId,
        countryCode: finalCountryCode,
        scope: scope,
        userId: userId ?? null,
        title: createDto.title,
        description: createDto.description,
        avoidanceTip: createDto.avoidanceTip ?? null,
        scamCategory: createDto.scamCategory,
        sourceUrl: formatExternalUrl(createDto.sourceUrl),
        imageUrls: createDto.imageUrls ?? [],
      }, tx);
    });
  }

  async update(id: string, updateDto: UpdateScamInfoZodDto, userId: string, userRole: string) {
    const scam = await this.scamsRepository.findById(id);
    if (!scam) {
      throw new NotFoundException('해당 사기 정보를 찾을 수 없습니다.');
    }

    const isSuperAdmin = userRole === 'super_admin';
    const isOwner = scam.userId === userId;
    if (!isSuperAdmin && !isOwner) {
      throw new ForbiddenException('수정 권한이 없습니다.');
    }

    const payload = { ...updateDto };
    if (payload.sourceUrl !== undefined) {
      payload.sourceUrl = formatExternalUrl(payload.sourceUrl);
    }

    const updateResult = await this.scamsRepository.update(id, payload);

    // 이미지 리스트가 수정 요청에 포함되어 있는 경우 (undefined가 아닌 경우)
    if (updateDto.imageUrls !== undefined) {
      const oldImageUrls = (scam.imageUrls || []) as string[];
      const newImageUrls = (updateDto.imageUrls || []) as string[];

      // 기존 리스트에는 있었으나 새 리스트에는 없는 이미지 파일 찾아 삭제
      const removedUrls = oldImageUrls.filter(url => !newImageUrls.includes(url));
      if (removedUrls.length > 0) {
        for (const url of removedUrls) {
          try {
            const imagePath = this.uploadsService.extractPathFromUrl(url);
            if (imagePath) {
              await this.uploadsService.deleteImage(imagePath);
              this.logger.log(`Successfully deleted removed scam image from storage: ${url}`);
            }
          } catch (err) {
            this.logger.error(`Failed to delete removed scam image from storage: ${url}`, err);
          }
        }
      }
    }

    return updateResult;
  }

  async delete(id: string, userId: string, userRole: string) {
    const scam = await this.scamsRepository.findById(id);
    if (!scam) {
      throw new NotFoundException('해당 사기 정보를 찾을 수 없습니다.');
    }

    const isSuperAdmin = userRole === 'super_admin';
    const isOwner = scam.userId === userId;
    if (!isSuperAdmin && !isOwner) {
      throw new ForbiddenException('삭제 권한이 없습니다.');
    }

    // 제보에 달린 댓글들의 이미지 URL 사전 수집 및 댓글 소프트 딜리트
    const commentImages = await this.scamsRepository.findCommentImagesByScam(id);
    await this.scamsRepository.softDeleteCommentsByScam(id);

    const deleteResult = await this.scamsRepository.update(id, { deletedAt: new Date() });

    // 제보 본문 이미지 삭제
    if (scam.imageUrls && Array.isArray(scam.imageUrls)) {
      const urls = scam.imageUrls as string[];
      for (const url of urls) {
        try {
          const imagePath = this.uploadsService.extractPathFromUrl(url);
          if (imagePath) {
            await this.uploadsService.deleteImage(imagePath);
            this.logger.log(`Successfully deleted scam image from storage: ${url}`);
          }
        } catch (err) {
          this.logger.error(`Failed to delete scam image from storage: ${url}`, err);
        }
      }
    }

    // 제보 관련 댓글 이미지 개별 스토리지 클린업
    for (const url of commentImages) {
      if (url) {
        try {
          const imagePath = this.uploadsService.extractPathFromUrl(url);
          if (imagePath) {
            await this.uploadsService.deleteImage(imagePath);
            this.logger.log(`Successfully deleted comment image for deleted scam ${id}: ${url}`);
          }
        } catch (err) {
          this.logger.error(`Failed to delete comment image ${url} for scam ${id}:`, err);
        }
      }
    }

    return deleteResult;
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
    if (!scamInfoId || typeof scamInfoId !== 'string') {
      throw new BadRequestException('제보 ID가 전달되지 않았습니다.');
    }

    const scam = await this.scamsRepository.findById(scamInfoId);
    if (!scam) {
      throw new NotFoundException('해당 사기 정보를 찾을 수 없습니다.');
    }

    try {
      return await this.scamsRepository.transaction(async (tx) => {
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
    } catch (err: any) {
      this.logger.warn(`Reaction toggle conflict gracefully handled for scam ${scamInfoId}: ${err?.message}`);
      await this.scamsRepository.recalculateReactionCounts(scamInfoId).catch(() => {});
      return this.scamsRepository.findById(scamInfoId);
    }
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

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResponse> {
    try {
      return await this.geocodingProvider.reverseGeocode(lat, lng);
    } catch (error) {
      this.logger.error('Geocoding Error:', error);
      return {
        place_id: 'error_fallback',
        name: '',
        display_name: '위치 정보 획득 실패',
        address: { city: '기타 도시', country: '기타 국가', country_code: 'etc' },
        lat: String(lat),
        lon: String(lng)
      };
    }
  }

  async searchAddress(query: string): Promise<GeocodeResponse[]> {
    try {
      return await this.geocodingProvider.searchAddress(query);
    } catch (error) {
      this.logger.error('Search Geocoding Error:', error);
      return [];
    }
  }

  async getAdminScams(params: {
    page: number;
    limit: number;
    search?: string;
    scope?: string;
    countryCode?: string;
    cityId?: string;
    scamCategory?: string;
  }) {
    return this.scamsRepository.findAdminScams(params);
  }

  async deleteAdminScam(id: string) {
    const scam = await this.scamsRepository.findById(id);
    if (!scam) {
      throw new NotFoundException('해당 사기 정보를 찾을 수 없습니다.');
    }

    // 연관 이미지 스토리지 삭제
    await this.deleteScamImagesFromStorage(scam.imageUrls);

    return this.scamsRepository.deleteAdminScam(id);
  }

  async deleteAdminScamsBulk(ids: string[]) {
    if (!ids || ids.length === 0) return [];

    const scams = await this.scamsRepository.findByIds(ids);
    for (const scam of scams) {
      await this.deleteScamImagesFromStorage(scam.imageUrls);
    }

    return this.scamsRepository.deleteAdminScamsBulk(ids);
  }

  private async deleteScamImagesFromStorage(imageUrls: any) {
    if (!imageUrls) return;
    let urls: string[] = [];
    if (Array.isArray(imageUrls)) {
      urls = imageUrls.filter((u) => typeof u === 'string');
    } else if (typeof imageUrls === 'string') {
      try {
        const parsed = JSON.parse(imageUrls);
        if (Array.isArray(parsed)) urls = parsed.filter((u) => typeof u === 'string');
        else urls = [imageUrls];
      } catch {
        urls = [imageUrls];
      }
    }

    for (const url of urls) {
      try {
        const path = this.uploadsService.extractPathFromUrl(url);
        if (path) {
          await this.uploadsService.deleteImage(path);
          this.logger.log(`Deleted scam image file from storage: ${path}`);
        }
      } catch (err) {
        this.logger.error(`Failed to delete scam image file from storage: ${url}`, err);
      }
    }
  }

  async bulkImportAdminScams(items: any[]) {
    if (!items || items.length === 0) return { importedCount: 0, skippedCount: 0 };
    let importedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      try {
        if (!item.title || !item.title.trim()) continue;

        const countryCode = (item.countryCode || 'KR').toUpperCase();
        const cityName = item.cityName || '기타 도시';
        const regionName = item.regionName || item.title || '일반 지역';
        const latitude = item.latitude ?? 0;
        const longitude = item.longitude ?? 0;
        const scope = item.scope || 'spot';

        // 1. findOrCreate Country
        let country = await this.scamsRepository.findCountryByCode(countryCode);
        if (!country) {
          const koreanName = getKoreanCountryName(countryCode);
          country = await this.scamsRepository.createCountry({
            code: countryCode,
            name: koreanName,
            nameEn: countryCode,
          });
        }

        // 2. findOrCreate City
        let city = await this.scamsRepository.findCityByName(cityName, countryCode);
        if (!city) {
          city = await this.scamsRepository.createCity({
            countryCode: countryCode,
            name: cityName,
            nameEn: cityName,
            latitude: Number(latitude),
            longitude: Number(longitude),
          });
        }

        // 3. 중복 제보 검사 (동일 제목 + 동일 국가/도시)
        const duplicateScam = await this.scamsRepository.findDuplicateScam(
          item.title,
          countryCode,
          city.id
        );

        if (duplicateScam) {
          this.logger.log(`Skipping duplicate scam item: "${item.title}"`);
          skippedCount++;
          continue;
        }

        // 4. findOrCreate Region (spot 또는 region일 때)
        let regionId: string | undefined = undefined;
        if (scope === 'spot' || scope === 'region') {
          let region = await this.scamsRepository.findRegionByName(regionName, city.id);
          if (!region) {
            region = await this.scamsRepository.createRegion({
              cityId: city.id,
              name: regionName,
              nameEn: regionName,
              latitude: Number(latitude),
              longitude: Number(longitude),
            });
          }
          regionId = region.id;
        }

        // 5. Create ScamInfo
        await this.scamsRepository.create({
          countryCode: countryCode,
          cityId: city.id,
          regionId: regionId,
          scope: scope,
          scamCategory: item.scamCategory || 'OVERCHARGING',
          title: item.title.trim(),
          description: item.description,
          avoidanceTip: item.avoidanceTip || null,
          sourceUrl: formatExternalUrl(item.sourceUrl),
          imageUrls: item.imageUrls || null,
        });

        importedCount++;
      } catch (err) {
        this.logger.error(`Failed to bulk import scam item: ${item.title}`, err);
      }
    }

    return { importedCount, skippedCount };
  }
}
