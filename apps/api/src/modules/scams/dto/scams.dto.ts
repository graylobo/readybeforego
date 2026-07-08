import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateScamInfoSchema = z.object({
  regionId: z.string().uuid(),
  title: z.string().min(2, '제목은 2자 이상이어야 합니다.').max(100),
  description: z.string().min(10, '설명은 10자 이상이어야 합니다.'),
  avoidanceTip: z.string().max(1000).optional(),
  scamCategory: z.string().min(1),
  sourceUrl: z.string().url().or(z.literal('')).optional(),
});
export class CreateScamInfoZodDto extends createZodDto(CreateScamInfoSchema) {}

export const UpdateScamInfoSchema = CreateScamInfoSchema.partial();
export class UpdateScamInfoZodDto extends createZodDto(UpdateScamInfoSchema) {}

export const ToggleScamReactionSchema = z.object({
  type: z.enum(['like', 'dislike']),
});
export class ToggleScamReactionZodDto extends createZodDto(ToggleScamReactionSchema) {}
