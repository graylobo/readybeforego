import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const CreateReportSchema = z.object({
  targetType: z.enum(['POST', 'COMMENT']),
  targetId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});
export class CreateReportZodDto extends createZodDto(CreateReportSchema) {}

export const ResolveReportSchema = z.object({
  status: z.enum(['resolved', 'rejected']),
});
export class ResolveReportZodDto extends createZodDto(ResolveReportSchema) {}
