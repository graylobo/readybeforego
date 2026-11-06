import {
  SIGHTING_MAX_DISTANCE_FROM_CITY_M,
  SIGHTING_MAX_DISTANCE_FROM_REGION_M,
  SCAM_DELETED_RETENTION_DAYS,
  SightingDatePrecision,
} from '@community/shared-types';
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

function hasOtherCategory(scamCategory?: string | null) {
  return (scamCategory || '').split(',').map((c) => c.trim()).includes('OTHER');
}

function normalizeAudienceNationalities(value?: string | null): string | null {
  if (!value) return null;
  const codes = [...new Set(
    value.split(',').map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c))
  )].slice(0, 3);
  return codes.length > 0 ? codes.join(',') : null;
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

const SCAM_IMAGE_FOLDER = 'scams';

const SIGHTING_FUTURE_MARGIN_MS = 24 * 60 * 60 * 1000;

// 약 100m 단위. 공개되는 위치에서 개인의 정확한 동선이 드러나지 않게 한다
const roundForPrivacy = (value: number) => Math.round(value * 1000) / 1000;

function distanceInMeters(a: [number, number], b: [number, number]) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
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

  // 제보 사진은 본인이 올린 파일만 받는다. 수정할 때 이미 붙어 있던 사진은 그대로 둘 수 있다 (관리자가 다른 사람 제보를 고치는 경우)
  private assertAttachableImages(urls: string[] | null | undefined, userId: string | undefined, existing: string[] = []) {
    for (const url of urls ?? []) {
      if (!existing.includes(url) && !this.uploadsService.ownedImagePath(url, SCAM_IMAGE_FOLDER, userId)) {
        throw new BadRequestException('제보에는 직접 올린 사진만 첨부할 수 있습니다.');
      }
    }
  }

  // 저장소에서 지워도 되는 제보 사진. 제보 작성자가 올린 파일만 지워, 주소가 잘못 들어가도 다른 파일이 지워지지 않게 한다
  private async deleteOwnedScamImages(urls: string[], ownerId: string | null | undefined) {
    for (const url of urls) {
      const path = this.uploadsService.ownedImagePath(url, SCAM_IMAGE_FOLDER, ownerId);
      if (!path) continue;
      try {
        await this.uploadsService.deleteImage(path);
        this.logger.log(`Deleted scam image from storage: ${path}`);
      } catch (err) {
        this.logger.error(`Failed to delete scam image from storage: ${path}`, err);
      }
    }
  }

  async create(createDto: CreateScamInfoZodDto, userId?: string) {
    this.assertAttachableImages(createDto.imageUrls, userId);
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
        reportType: (createDto.reportType as any) ?? 'CAUTION',
        userId: userId ?? null,
        title: createDto.title,
        description: createDto.description,
        avoidanceTip: createDto.avoidanceTip ?? null,
        subLocation: createDto.subLocation ?? null,
        scamCategory: createDto.scamCategory,
        otherCategoryNote: hasOtherCategory(createDto.scamCategory)
          ? (createDto.otherCategoryNote?.trim() || null)
          : null,
        audienceNationalities: normalizeAudienceNationalities(createDto.audienceNationalities),
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

    const existingImageUrls = (Array.isArray(scam.imageUrls) ? scam.imageUrls : []) as string[];
    this.assertAttachableImages(updateDto.imageUrls, userId, existingImageUrls);

    const payload = { ...updateDto };
    if (payload.sourceUrl !== undefined) {
      payload.sourceUrl = formatExternalUrl(payload.sourceUrl);
    }
    if (payload.audienceNationalities !== undefined) {
      payload.audienceNationalities = normalizeAudienceNationalities(payload.audienceNationalities);
    }

    const nextCategory = payload.scamCategory ?? scam.scamCategory;
    const nextCats = (nextCategory || '').split(',').map((c) => c.trim()).filter(Boolean);
    if (nextCats.includes('OTHER') && nextCats.length > 1) {
      throw new BadRequestException('기타는 다른 카테고리와 함께 선택할 수 없습니다.');
    }
    if (!hasOtherCategory(nextCategory)) {
      payload.otherCategoryNote = null;
    } else {
      const nextNote = (payload.otherCategoryNote !== undefined
        ? payload.otherCategoryNote
        : scam.otherCategoryNote)?.trim() || '';
      if (nextNote.length < 2) {
        throw new BadRequestException('기타를 고르면 어떤 내용인지 한 줄로 알려 주세요.');
      }
      if (payload.otherCategoryNote !== undefined) {
        payload.otherCategoryNote = nextNote;
      }
    }

    const updateResult = await this.scamsRepository.update(id, payload);

    // 이미지 리스트가 수정 요청에 포함되어 있는 경우 (undefined가 아닌 경우)
    if (updateDto.imageUrls !== undefined) {
      const newImageUrls = (updateDto.imageUrls || []) as string[];

      // 기존 리스트에는 있었으나 새 리스트에는 없는 이미지 파일 찾아 삭제
      await this.deleteOwnedScamImages(
        existingImageUrls.filter((url) => !newImageUrls.includes(url)),
        scam.userId,
      );
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

    // 제보 사진은 관리자가 복원할 수 있도록 남겨 두고, 영구 삭제할 때 저장소에서 지운다

    // 제보 관련 댓글 이미지 개별 스토리지 클린업
    for (const url of commentImages) {
      if (url) {
        try {
          const imagePath = this.uploadsService.extractCommentImagePath(url);
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

  async getSightings(scamInfoId: string) {
    return this.scamsRepository.findSightings(scamInfoId);
  }

  async saveSighting(
    scamInfoId: string,
    userId: string,
    data: { latitude: number; longitude: number; seenOn: string; seenPrecision: SightingDatePrecision },
  ) {
    const scam = await this.scamsRepository.findById(scamInfoId);
    if (!scam || scam.deletedAt) {
      throw new NotFoundException('해당 주의사항을 찾을 수 없습니다.');
    }
    if (scam.reportType === 'TIP') {
      throw new BadRequestException('꿀팁에는 겪은 위치를 기록할 수 없습니다.');
    }

    // 사용자 시간대가 서버보다 앞설 수 있어 하루의 여유를 둔다
    const seenAt = new Date(`${data.seenOn}T00:00:00Z`);
    const isRealDate = !Number.isNaN(seenAt.getTime()) && seenAt.toISOString().slice(0, 10) === data.seenOn;
    if (!isRealDate || seenAt.getTime() > Date.now() + SIGHTING_FUTURE_MARGIN_MS) {
      throw new BadRequestException('겪은 날짜를 다시 확인해 주세요.');
    }
    // seenOn은 정밀도에 맞는 기간의 첫날이어야 나중에 기간을 일관되게 계산할 수 있다
    const isPeriodStart =
      data.seenPrecision === 'day' ||
      (data.seenPrecision === 'week' && seenAt.getUTCDay() === 1) ||
      (data.seenPrecision === 'month' && seenAt.getUTCDate() === 1);
    if (!isPeriodStart) {
      throw new BadRequestException('겪은 날짜를 다시 확인해 주세요.');
    }

    const anchor = await this.findSightingAnchor(scam);
    if (anchor && distanceInMeters(anchor.point, [data.latitude, data.longitude]) > anchor.maxDistanceM) {
      throw new BadRequestException('이 주의사항의 지역에서 너무 먼 위치입니다. 겪은 위치를 다시 골라 주세요.');
    }

    await this.scamsRepository.upsertSighting({
      scamInfoId,
      userId,
      latitude: roundForPrivacy(data.latitude),
      longitude: roundForPrivacy(data.longitude),
      seenOn: data.seenOn,
      seenPrecision: data.seenPrecision,
    });
    return this.scamsRepository.findSightings(scamInfoId);
  }

  async deleteAdminSighting(sightingId: string, adminId: string) {
    const deleted = await this.scamsRepository.deleteSightingAndResolveReports(sightingId, adminId);
    if (!deleted) {
      throw new NotFoundException('해당 기록을 찾을 수 없습니다.');
    }
    return { id: sightingId };
  }

  // 지운 지 보관 기간이 지난 제보를 사진과 함께 영구 삭제한다. 외부 스케줄러가 jobs/scams-purge-deleted를 매일 실행한다
  async purgeExpiredDeletedScams(now = new Date()) {
    const cutoff = new Date(now.getTime() - SCAM_DELETED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const expired = await this.scamsRepository.findDeletedBefore(cutoff);
    let purgedCount = 0;
    for (const scam of expired) {
      try {
        await this.deleteAdminScam(scam.id);
        purgedCount++;
      } catch (err) {
        // 하나가 실패해도 나머지는 지우고, 실패한 제보는 다음 실행 때 다시 시도한다
        this.logger.error(`Failed to purge deleted scam ${scam.id}`, err);
      }
    }
    return { foundCount: expired.length, purgedCount };
  }

  async deleteSighting(scamInfoId: string, userId: string) {
    await this.scamsRepository.deleteSighting(scamInfoId, userId);
    return this.scamsRepository.findSightings(scamInfoId);
  }

  // 엉뚱한 나라에 찍힌 기록을 막기 위한 기준점. 나라 전체 주의사항은 범위를 제한하지 않는다
  private async findSightingAnchor(scam: { regionId?: string | null; cityId?: string | null }) {
    if (scam.regionId) {
      const region = await this.scamsRepository.findRegionById(scam.regionId);
      if (region) {
        return { point: [region.latitude, region.longitude] as [number, number], maxDistanceM: SIGHTING_MAX_DISTANCE_FROM_REGION_M };
      }
    }
    if (scam.cityId) {
      const city = await this.scamsRepository.findCityById(scam.cityId);
      if (city) {
        return { point: [city.latitude, city.longitude] as [number, number], maxDistanceM: SIGHTING_MAX_DISTANCE_FROM_CITY_M };
      }
    }
    return null;
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
        // 1. 해당 유저/IP의 모든 기존 반응 조회 (중복 데이터가 존재할 가능성 사전 탐지)
        const existingReactions = await this.scamsRepository.findReactions(
          scamInfoId,
          userId,
          ipAddress,
          tx
        );

        const hadSameReaction = existingReactions.some((r) => r.type === type);

        // 2. 기존 반응 레코드 전체 원자적 삭제 (중복 데이터 자동 청소)
        await this.scamsRepository.deleteAllReactionsByUser(
          scamInfoId,
          userId,
          ipAddress,
          tx
        );

        // 3. 기존에 동일한 타입의 반응을 클릭하지 않은 경우(새 반응 등록 또는 다른 반응으로 변경)만 1개 추가
        if (!hadSameReaction) {
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

        // 4. 카운트 재계산 후 최신 객체 반환
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

  async getAreaSummaries() {
    return this.scamsRepository.findAreaSummaries();
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
    includeDeleted?: boolean;
  }) {
    return this.scamsRepository.findAdminScams({
      ...params,
      includeDeleted: params.includeDeleted ?? true, // 관리자 목록에서는 soft-deleted 항목도 포함
    });
  }

  async deleteAdminScam(id: string) {
    const scam = await this.scamsRepository.findById(id);
    if (!scam) {
      throw new NotFoundException('해당 사기 정보를 찾을 수 없습니다.');
    }

    // 연관 이미지 스토리지 삭제
    await this.deleteScamImagesFromStorage(scam.imageUrls, scam.userId);

    return this.scamsRepository.deleteAdminScam(id);
  }

  async restoreAdminScam(id: string) {
    return this.scamsRepository.update(id, { deletedAt: null });
  }

  async deleteAdminScamsBulk(ids: string[]) {
    if (!ids || ids.length === 0) return [];

    const scams = await this.scamsRepository.findByIds(ids);
    for (const scam of scams) {
      await this.deleteScamImagesFromStorage(scam.imageUrls, scam.userId);
    }

    return this.scamsRepository.deleteAdminScamsBulk(ids);
  }

  private async deleteScamImagesFromStorage(imageUrls: any, ownerId: string | null | undefined) {
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
    await this.deleteOwnedScamImages(urls, ownerId);
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
