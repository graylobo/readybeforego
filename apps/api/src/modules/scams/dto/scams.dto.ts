import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateScamInfoBaseSchema = z.object({
  regionId: z.string().optional(),
  regionName: z.string().min(2, '세부 장소/지역명은 최소 2자 이상이어야 합니다.').optional(),
  cityId: z.string().optional(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
  cityName: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  scope: z.enum(['spot', 'region', 'city', 'country']).optional().default('spot'),
  reportType: z.enum(['CAUTION', 'TIP', 'INFO']).optional().default('CAUTION'),
  title: z.string().min(2, '제보 제목은 최소 2자 이상이어야 합니다.').max(100, '제목은 최대 100자까지 작성 가능합니다.'),
  description: z.string().min(10, '상세 피해 내용은 최소 10자 이상 자세히 작성해 주세요.'),
  avoidanceTip: z.string().max(1000, '대처법은 최대 1000자까지 입력 가능합니다.').nullable().optional(),
  scamCategory: z.string().min(1, '사기 피해 카테고리를 최소 1개 이상 선택해 주세요.'),
  sourceUrl: z.string().url('유효한 URL 형식이 아닙니다.').or(z.literal('')).nullable().optional(),
  imageUrls: z.array(z.string().url()).nullable().optional(),
});

export const CreateScamInfoSchema = CreateScamInfoBaseSchema.refine(
  data => {
    const scope = data.scope || 'spot';

    // 1. 국가 범위 제보 검증
    if (scope === 'country') {
      return !!(data.countryCode || data.countryName);
    }

    // 2. 도시 범위 제보 검증
    if (scope === 'city') {
      return !!(data.cityId || (data.cityName && (data.countryCode || data.countryName)));
    }

    // 3. 지점/골목 및 구역 전체 범위 제보 검증
    if (scope === 'spot' || scope === 'region') {
      if (data.regionId) return true;
      
      const hasNewRegionBase = !!(data.regionName && data.latitude !== undefined && data.longitude !== undefined);
      if (!hasNewRegionBase) return false;
      
      const hasCityRelation = !!(data.cityId || (data.cityName && (data.countryCode || data.countryName)));
      return hasCityRelation;
    }

    return false;
  },
  {
    message: '제보 적용 범위에 따른 국가/도시/세부 장소명이 올바르게 선택되지 않았습니다.',
    path: ['cityId'],
  }
);

export class CreateScamInfoZodDto extends createZodDto(CreateScamInfoSchema) {}

export const UpdateScamInfoSchema = CreateScamInfoBaseSchema.partial();
export class UpdateScamInfoZodDto extends createZodDto(UpdateScamInfoSchema) {}

export const ToggleScamReactionSchema = z.object({
  type: z.enum(['like', 'dislike']),
});
export class ToggleScamReactionZodDto extends createZodDto(ToggleScamReactionSchema) {}

export const BulkImportScamsSchema = z.object({
  items: z.array(z.object({
    countryCode: z.string().min(2),
    cityName: z.string().min(1),
    regionName: z.string().optional(),
    scope: z.enum(['spot', 'region', 'city', 'country']).optional().default('spot'),
    scamCategory: z.string().min(1),
    title: z.string().min(2),
    description: z.string().min(5),
    avoidanceTip: z.string().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    sourceUrl: z.string().optional().nullable(),
    imageUrls: z.array(z.string()).optional().nullable(),
  })),
});
export class BulkImportScamZodDto extends createZodDto(BulkImportScamsSchema) {}
