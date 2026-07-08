import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateScamInfoSchema = z.object({
  regionId: z.string().uuid().optional(),
  regionName: z.string().min(2, '지역명은 2자 이상이어야 합니다.').optional(),
  cityId: z.string().uuid().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  title: z.string().min(2, '제목은 2자 이상이어야 합니다.').max(100),
  description: z.string().min(10, '설명은 10자 이상이어야 합니다.'),
  avoidanceTip: z.string().max(1000).optional(),
  scamCategory: z.string().min(1),
  sourceUrl: z.string().url().or(z.literal('')).optional(),
  imageUrls: z.array(z.string().url()).optional(),
}).refine(data => data.regionId || (data.regionName && data.cityId && data.latitude !== undefined && data.longitude !== undefined), {
  message: '기존 지역 ID가 없으면 새 지역 정보(이름, 도시, 위경도)가 필수입니다.',
  path: ['regionId'],
});
export class CreateScamInfoZodDto extends createZodDto(CreateScamInfoSchema) {}

export const UpdateScamInfoSchema = CreateScamInfoSchema.partial();
export class UpdateScamInfoZodDto extends createZodDto(UpdateScamInfoSchema) {}

export const ToggleScamReactionSchema = z.object({
  type: z.enum(['like', 'dislike']),
});
export class ToggleScamReactionZodDto extends createZodDto(ToggleScamReactionSchema) {}
