import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateScamInfoBaseSchema = z.object({
  regionId: z.string().optional(),
  regionName: z.string().min(2, '지역명은 2자 이상이어야 합니다.').optional(),
  cityId: z.string().optional(),
  countryCode: z.string().optional(),
  countryName: z.string().optional(),
  cityName: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  scope: z.enum(['spot', 'region', 'city', 'country']).optional().default('spot'),
  title: z.string().min(2, '제목은 2자 이상이어야 합니다.').max(100),
  description: z.string().min(10, '설명은 10자 이상이어야 합니다.'),
  avoidanceTip: z.string().max(1000).nullable().optional(),
  scamCategory: z.string().min(1),
  sourceUrl: z.string().url().or(z.literal('')).nullable().optional(),
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
    message: '제보 적용 범위(scope)에 따른 필수 지리 정보가 지정되지 않았습니다.',
    path: ['regionId'],
  }
);

export class CreateScamInfoZodDto extends createZodDto(CreateScamInfoSchema) {}

export const UpdateScamInfoSchema = CreateScamInfoBaseSchema.partial();
export class UpdateScamInfoZodDto extends createZodDto(UpdateScamInfoSchema) {}

export const ToggleScamReactionSchema = z.object({
  type: z.enum(['like', 'dislike']),
});
export class ToggleScamReactionZodDto extends createZodDto(ToggleScamReactionSchema) {}
