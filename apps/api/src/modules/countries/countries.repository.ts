import { Injectable, Inject, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, asc, like, or, sql } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../database/database.module';
import * as schema from '../../database/schema';
import { CreateCountryDto, UpdateCountryDto } from './dto/countries.dto';

function getFlagEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '✈️';
  try {
    return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
  } catch {
    return '✈️';
  }
}

@Injectable()
export class CountriesRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findAll(search?: string) {
    let whereClause: any = undefined;
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      whereClause = or(
        like(schema.countries.code, term),
        like(schema.countries.name, term),
        like(schema.countries.nameEn, term),
      );
    }

    const countries = await this.db.query.countries.findMany({
      where: whereClause,
      orderBy: [asc(schema.countries.name)],
    });

    return countries;
  }

  async findOne(code: string) {
    const country = await this.db.query.countries.findFirst({
      where: eq(schema.countries.code, code.toUpperCase()),
    });
    if (!country) {
      throw new NotFoundException(`국가 코드를 찾을 수 없습니다: ${code}`);
    }
    return country;
  }

  async create(dto: CreateCountryDto) {
    const code = dto.code.toUpperCase();
    const existing = await this.db.query.countries.findFirst({
      where: eq(schema.countries.code, code),
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 국가 코드입니다: ${code}`);
    }

    const computedEmoji = getFlagEmoji(code);

    const [country] = await this.db
      .insert(schema.countries)
      .values({
        code,
        name: dto.name,
        nameEn: dto.nameEn,
        emoji: dto.emoji && dto.emoji.trim() ? dto.emoji : computedEmoji,
        plug: dto.plug,
        visa: dto.visa,
        currency: dto.currency,
        currencyCode: dto.currencyCode || code,
      })
      .returning();

    return country;
  }

  async update(code: string, dto: UpdateCountryDto) {
    const upperCode = code.toUpperCase();
    await this.findOne(upperCode);

    const [updated] = await this.db
      .update(schema.countries)
      .set({
        ...dto,
        code: dto.code ? dto.code.toUpperCase() : upperCode,
        updatedAt: new Date(),
      })
      .where(eq(schema.countries.code, upperCode))
      .returning();

    return updated;
  }

  async delete(code: string) {
    const upperCode = code.toUpperCase();
    await this.findOne(upperCode);

    // 🛡️ 안전 방어벽: 연관된 사기 제보, 가이드, 도시 데이터 존재 여부 검사
    const [scamCountRes] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.scamInfos)
      .where(eq(schema.scamInfos.countryCode, upperCode));

    const [guideCountRes] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.countryGuides)
      .where(eq(schema.countryGuides.countryCode, upperCode));

    const scamCount = scamCountRes?.count || 0;
    const guideCount = guideCountRes?.count || 0;

    if (scamCount > 0 || guideCount > 0) {
      throw new BadRequestException(
        `[삭제 불가] 해당 국가에 등록된 사기 제보(${scamCount}건) 또는 가이드(${guideCount}건)가 존재합니다. 관련 데이터를 먼저 정리해 주세요.`
      );
    }

    await this.db
      .delete(schema.countries)
      .where(eq(schema.countries.code, upperCode));

    return { success: true, message: `${upperCode} 국가 마스터 데이터가 성공적으로 삭제되었습니다.` };
  }
}
