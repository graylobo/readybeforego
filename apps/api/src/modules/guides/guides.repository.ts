import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray, ne, asc, sql, and } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { CreateGuideZodDto, UpdateGuideZodDto } from './dto/guides.dto';

@Injectable()
export class GuidesRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByCountry(countryCode: string, includeCommon: boolean = true, cityId?: string) {
    const countryClause = includeCommon
      ? inArray(schema.countryGuides.countryCode, Array.from(new Set([countryCode, 'ALL'])))
      : eq(schema.countryGuides.countryCode, countryCode);

    let whereClause = countryClause;
    if (cityId && cityId.trim() && cityId !== 'all') {
      whereClause = and(
        countryClause,
        sql`(${schema.countryGuides.cityId} IS NULL OR ${schema.countryGuides.cityId} = ${cityId})`
      ) as any;
    }

    const guides = await this.db.query.countryGuides.findMany({
      where: whereClause,
      with: {
        city: true,
      },
      orderBy: [asc(schema.countryGuides.sortOrder), asc(schema.countryGuides.createdAt)],
    });

    return {
      guides,
    };
  }

  async findAvailableCountries() {
    const results = await this.db
      .select({
        countryCode: schema.countryGuides.countryCode,
        countryName: schema.countries.name,
        countryNameEn: schema.countries.nameEn,
        emoji: schema.countries.emoji,
        plug: schema.countries.plug,
        visa: schema.countries.visa,
        currency: schema.countries.currency,
        currencyCode: schema.countries.currencyCode,
        count: sql<number>`count(${schema.countryGuides.id})::int`,
      })
      .from(schema.countryGuides)
      .innerJoin(schema.countries, eq(schema.countryGuides.countryCode, schema.countries.code))
      .where(ne(schema.countryGuides.countryCode, 'ALL'))
      .groupBy(
        schema.countryGuides.countryCode,
        schema.countries.name,
        schema.countries.nameEn,
        schema.countries.emoji,
        schema.countries.plug,
        schema.countries.visa,
        schema.countries.currency,
        schema.countries.currencyCode,
      );

    return results;
  }

  async findAll() {
    const guides = await this.db.query.countryGuides.findMany({
      with: {
        city: true,
      },
      orderBy: [asc(schema.countryGuides.countryCode), asc(schema.countryGuides.sortOrder), asc(schema.countryGuides.createdAt)],
    });

    return {
      guides,
    };
  }

  private async ensureCountriesExist(countryCodes: string[]) {
    const uniqueCodes = Array.from(new Set(countryCodes.filter(c => c && c !== 'ALL')));
    if (uniqueCodes.length === 0) return;

    const COUNTRY_MAP: Record<string, { name: string; nameEn: string; emoji: string; plug: string; visa: string; currency: string; currencyCode: string }> = {
      JP: { name: '일본', nameEn: 'Japan', emoji: '🇯🇵', plug: '110V', visa: '무비자 90일', currency: '엔 (JPY)', currencyCode: 'JPY' },
      VN: { name: '베트남', nameEn: 'Vietnam', emoji: '🇻🇳', plug: '220V', visa: '무비자 45일', currency: '동 (VND)', currencyCode: 'VND' },
      TH: { name: '태국', nameEn: 'Thailand', emoji: '🇹🇭', plug: '220V / 겸용', visa: '무비자 90일', currency: '바트 (THB)', currencyCode: 'THB' },
      SG: { name: '싱가포르', nameEn: 'Singapore', emoji: '🇸🇬', plug: '230V / 어댑터', visa: '무비자 90일', currency: '싱가포르 달러 (SGD)', currencyCode: 'SGD' },
      PH: { name: '필리핀', nameEn: 'Philippines', emoji: '🇵🇭', plug: '220V / 110V', visa: '무비자 30일', currency: '페소 (PHP)', currencyCode: 'PHP' },
      TW: { name: '대만', nameEn: 'Taiwan', emoji: '🇹🇼', plug: '110V', visa: '무비자 90일', currency: '대만 달러 (TWD)', currencyCode: 'TWD' },
      US: { name: '미국', nameEn: 'United States', emoji: '🇺🇸', plug: '110V', visa: 'ESTA 전자비자', currency: '달러 (USD)', currencyCode: 'USD' },
      FR: { name: '프랑스', nameEn: 'France', emoji: '🇫🇷', plug: '230V', visa: '무비자 90일', currency: '유로 (EUR)', currencyCode: 'EUR' },
      IT: { name: '이탈리아', nameEn: 'Italy', emoji: '🇮🇹', plug: '230V', visa: '무비자 90일', currency: '유로 (EUR)', currencyCode: 'EUR' },
      KR: { name: '대한민국', nameEn: 'South Korea', emoji: '🇰🇷', plug: '220V', visa: '내국인', currency: '원 (KRW)', currencyCode: 'KRW' },
    };

    for (const code of uniqueCodes) {
      const computedEmoji = code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt(0))) : '✈️';
      const meta = COUNTRY_MAP[code] || {
        name: code,
        nameEn: code,
        emoji: computedEmoji,
        plug: '220V / 변환 어댑터',
        visa: '무비자 여부 확인',
        currency: `${code} 통화`,
        currencyCode: code,
      };

      await this.db
        .insert(schema.countries)
        .values({
          code,
          name: meta.name,
          nameEn: meta.nameEn,
          emoji: meta.emoji,
          plug: meta.plug,
          visa: meta.visa,
          currency: meta.currency,
          currencyCode: meta.currencyCode,
        })
        .onConflictDoUpdate({
          target: schema.countries.code,
          set: {
            name: meta.name,
            emoji: meta.emoji,
            plug: meta.plug,
            visa: meta.visa,
            currency: meta.currency,
            currencyCode: meta.currencyCode,
            updatedAt: new Date(),
          },
        });
    }
  }

  async createGuide(data: CreateGuideZodDto) {
    if (data.countryCode) {
      await this.ensureCountriesExist([data.countryCode]);
    }

    const [existing] = await this.db
      .select()
      .from(schema.countryGuides)
      .where(
        and(
          eq(schema.countryGuides.countryCode, data.countryCode),
          eq(schema.countryGuides.title, data.title),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(schema.countryGuides)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.countryGuides.id, existing.id))
        .returning();
      return updated;
    }

    const [guide] = await this.db
      .insert(schema.countryGuides)
      .values(data)
      .returning();
    return guide;
  }

  private async ensureCityExists(
    countryCode: string,
    cityNameEn?: string | null,
    cityNameKo?: string | null,
    cityName?: string | null,
  ): Promise<string | null> {
    const searchTerms = [cityNameKo, cityNameEn, cityName]
      .filter(Boolean)
      .map(s => String(s).trim());

    if (searchTerms.length === 0) return null;

    const normalizedTerms = searchTerms.map(s => s.toLowerCase());

    // 1. 기존 cities 테이블에서 매칭 시도
    const existingCities = await this.db
      .select()
      .from(schema.cities)
      .where(eq(schema.cities.countryCode, countryCode));

    const found = existingCities.find(c => {
      const cName = c.name.trim().toLowerCase();
      const cNameEn = c.nameEn.trim().toLowerCase();
      return normalizedTerms.some(
        term => term === cName || term === cNameEn || term.includes(cName) || cName.includes(term),
      );
    });

    if (found) return found.id;

    // 2. 매칭 실패 시 자동 생성 (upsert)
    const resolvedNameEn = cityNameEn?.trim() || cityName?.trim() || 'Unknown';
    const resolvedNameKo = cityNameKo?.trim() || cityName?.trim() || resolvedNameEn;

    // 주요 도시 위경도 매핑 (자동 생성 시 사용)
    const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'osaka': { lat: 34.6937, lng: 135.5023 },
      'kyoto': { lat: 35.0116, lng: 135.7681 },
      'fukuoka': { lat: 33.5904, lng: 130.4017 },
      'sapporo': { lat: 43.0618, lng: 141.3545 },
      'nagoya': { lat: 35.1815, lng: 136.9066 },
      'okinawa': { lat: 26.3344, lng: 127.8056 },
      'bangkok': { lat: 13.7563, lng: 100.5018 },
      'chiang mai': { lat: 18.7883, lng: 98.9853 },
      'pattaya': { lat: 12.9236, lng: 100.8825 },
      'hanoi': { lat: 21.0278, lng: 105.8342 },
      'ho chi minh': { lat: 10.8231, lng: 106.6297 },
      'da nang': { lat: 16.0544, lng: 108.2022 },
      'singapore': { lat: 1.3521, lng: 103.8198 },
      'manila': { lat: 14.5995, lng: 120.9842 },
      'cebu': { lat: 10.3157, lng: 123.8854 },
      'taipei': { lat: 25.0330, lng: 121.5654 },
      'new york': { lat: 40.7128, lng: -74.0060 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'paris': { lat: 48.8566, lng: 2.3522 },
      'rome': { lat: 41.9028, lng: 12.4964 },
      'seoul': { lat: 37.5665, lng: 126.9780 },
      'busan': { lat: 35.1796, lng: 129.0756 },
      'jeju': { lat: 33.4996, lng: 126.5312 },
      // 한글 도시명 매핑
      '도쿄': { lat: 35.6762, lng: 139.6503 },
      '오사카': { lat: 34.6937, lng: 135.5023 },
      '교토': { lat: 35.0116, lng: 135.7681 },
      '후쿠오카': { lat: 33.5904, lng: 130.4017 },
      '삿포로': { lat: 43.0618, lng: 141.3545 },
      '나고야': { lat: 35.1815, lng: 136.9066 },
      '오키나와': { lat: 26.3344, lng: 127.8056 },
      '방콕': { lat: 13.7563, lng: 100.5018 },
      '치앙마이': { lat: 18.7883, lng: 98.9853 },
      '하노이': { lat: 21.0278, lng: 105.8342 },
      '호치민': { lat: 10.8231, lng: 106.6297 },
      '다낭': { lat: 16.0544, lng: 108.2022 },
      '싱가포르': { lat: 1.3521, lng: 103.8198 },
      '마닐라': { lat: 14.5995, lng: 120.9842 },
      '세부': { lat: 10.3157, lng: 123.8854 },
      '타이페이': { lat: 25.0330, lng: 121.5654 },
      '서울': { lat: 37.5665, lng: 126.9780 },
      '부산': { lat: 35.1796, lng: 129.0756 },
      '제주': { lat: 33.4996, lng: 126.5312 },
    };

    // 위경도 조회 (영문 → 한글 순서로 시도)
    const coordsKey = [resolvedNameEn.toLowerCase(), resolvedNameKo.toLowerCase()]
      .find(k => CITY_COORDS[k]);
    const coords = coordsKey ? CITY_COORDS[coordsKey] : { lat: 0, lng: 0 };

    const [created] = await this.db
      .insert(schema.cities)
      .values({
        countryCode,
        name: resolvedNameKo,
        nameEn: resolvedNameEn,
        latitude: coords.lat,
        longitude: coords.lng,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      console.log(`[BulkImport] Auto-created city: "${resolvedNameKo}" (${resolvedNameEn}) for ${countryCode}, id=${created.id}`);
      return created.id;
    }

    // onConflictDoNothing 후 returning이 비면 재검색
    const [retried] = await this.db
      .select()
      .from(schema.cities)
      .where(
        and(
          eq(schema.cities.countryCode, countryCode),
          eq(schema.cities.nameEn, resolvedNameEn),
        ),
      )
      .limit(1);

    return retried?.id || null;
  }

  async createGuidesBulk(items: any[]) {
    if (!items || items.length === 0) return { count: 0 };
    const countryCodes = items.map(item => item.countryCode).filter(Boolean);
    await this.ensureCountriesExist(countryCodes);

    let count = 0;
    for (const rawItem of items) {
      const { cityName, cityNameEn, cityNameKo, cityId: rawCityId, ...cleanItem } = rawItem;
      let matchedCityId: string | null = null;

      // 1. rawCityId가 이미 UUID인 경우
      if (rawCityId && String(rawCityId).trim()) {
        matchedCityId = String(rawCityId).trim();
      }

      // 2. 도시명이 전달된 경우 - 검색 후 없으면 자동 생성
      if (!matchedCityId) {
        const countryCode = String(cleanItem.countryCode || '').trim().toUpperCase();
        matchedCityId = await this.ensureCityExists(
          countryCode,
          cityNameEn,
          cityNameKo,
          cityName,
        );
      }

      const payload = {
        countryCode: String(cleanItem.countryCode).toUpperCase(),
        category: cleanItem.category,
        title: cleanItem.title,
        description: cleanItem.description,
        icon: cleanItem.icon || "📌",
        isRequired: !!cleanItem.isRequired,
        isCheckable: cleanItem.isCheckable !== false,
        sortOrder: Number(cleanItem.sortOrder) || 0,
        cityId: matchedCityId,
      };

      console.log(`[BulkImport Payload Log] Title: "${payload.title}" | Matched cityId: "${payload.cityId}"`);

      const [existing] = await this.db
        .select()
        .from(schema.countryGuides)
        .where(
          and(
            eq(schema.countryGuides.countryCode, payload.countryCode),
            eq(schema.countryGuides.title, payload.title),
          ),
        )
        .limit(1);

      if (existing) {
        await this.db
          .update(schema.countryGuides)
          .set({ ...payload, updatedAt: new Date() })
          .where(eq(schema.countryGuides.id, existing.id));
      } else {
        await this.db
          .insert(schema.countryGuides)
          .values(payload);
      }
      count++;
    }

    return { count };
  }

  async updateGuide(id: string, data: UpdateGuideZodDto) {
    const [updated] = await this.db
      .update(schema.countryGuides)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.countryGuides.id, id))
      .returning();
    return updated;
  }

  async deleteGuide(id: string) {
    await this.db
      .delete(schema.countryGuides)
      .where(eq(schema.countryGuides.id, id));
    return { success: true };
  }

  async deleteGuides(ids: string[]) {
    if (!ids || ids.length === 0) return { success: true, count: 0 };
    await this.db
      .delete(schema.countryGuides)
      .where(inArray(schema.countryGuides.id, ids));
    return { success: true, count: ids.length };
  }
}
