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
  title: z.string().min(2, '제목은 2자 이상이어야 합니다.').max(100),
  description: z.string().min(10, '설명은 10자 이상이어야 합니다.'),
  avoidanceTip: z.string().max(1000).nullable().optional(),
  scamCategory: z.string().min(1),
  sourceUrl: z.string().url().or(z.literal('')).nullable().optional(),
  imageUrls: z.array(z.string().url()).nullable().optional(),
});

export const CreateScamInfoSchema = CreateScamInfoBaseSchema.refine(
  data => {
    // 1. 기존 지역 ID가 있으면 통과
    if (data.regionId) return true;
    
    // 2. 기존 지역 ID가 없으면 신규 지역 생성 정보 필요
    const hasNewRegionBase = !!(data.regionName && data.latitude !== undefined && data.longitude !== undefined);
    if (!hasNewRegionBase) return false;
    
    // 3. 상위 도시 관계 검증: 기존 cityId가 있거나, 신규 cityName과 국가 정보(countryCode 또는 countryName)가 있어야 함.
    const hasCityRelation = !!(data.cityId || (data.cityName && (data.countryCode || data.countryName)));
    return hasCityRelation;
  },
  {
    message: '기존 지역 ID가 없으면 새 지역 정보(이름, 도시, 위경도)가 필수입니다.',
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
