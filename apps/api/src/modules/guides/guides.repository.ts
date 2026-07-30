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

  async findByCountry(countryCode: string, includeCommon: boolean = true) {
    const whereClause = includeCommon
      ? inArray(schema.countryGuides.countryCode, Array.from(new Set([countryCode, 'ALL'])))
      : eq(schema.countryGuides.countryCode, countryCode);

    const guides = await this.db.query.countryGuides.findMany({
      where: whereClause,
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

  async createGuidesBulk(items: any[]) {
    if (!items || items.length === 0) return { count: 0 };
    const countryCodes = items.map(item => item.countryCode);
    await this.ensureCountriesExist(countryCodes);

    let count = 0;
    for (const item of items) {
      const [existing] = await this.db
        .select()
        .from(schema.countryGuides)
        .where(
          and(
            eq(schema.countryGuides.countryCode, item.countryCode),
            eq(schema.countryGuides.title, item.title),
          ),
        )
        .limit(1);

      if (existing) {
        await this.db
          .update(schema.countryGuides)
          .set({ ...item, updatedAt: new Date() })
          .where(eq(schema.countryGuides.id, existing.id));
      } else {
        await this.db
          .insert(schema.countryGuides)
          .values(item);
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
