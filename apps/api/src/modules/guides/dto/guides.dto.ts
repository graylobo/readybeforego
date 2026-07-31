import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const createGuideSchema = z.object({
  countryCode: z.string().min(2).max(5),
  cityId: z.string().nullable().optional(),
  category: z.enum(['pre_travel', 'essentials', 'baggage', 'tips']),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  icon: z.string().optional(),
  isRequired: z.boolean().optional().default(false),
  isCheckable: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0),
});

export const updateGuideSchema = createGuideSchema.partial();

export class CreateGuideZodDto extends createZodDto(createGuideSchema) {}
export class UpdateGuideZodDto extends createZodDto(updateGuideSchema) {}
