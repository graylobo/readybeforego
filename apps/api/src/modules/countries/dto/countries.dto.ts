import { z } from 'zod';
import { createZodDto } from '@anatine/zod-nestjs';

export const CreateCountrySchema = z.object({
  code: z.string().min(2).max(10).describe('ISO 2자 국가 코드 (예: TH, SG)'),
  name: z.string().min(1).describe('국가 한국어 명칭 (예: 태국)'),
  nameEn: z.string().min(1).describe('국가 영문 명칭 (예: Thailand)'),
  emoji: z.string().optional().describe('국기 이모지 (예: 🇹🇭)'),
  plug: z.string().optional().describe('전압/플러그 정보 (예: 220V / 겸용)'),
  visa: z.string().optional().describe('비자 조건 (예: 무비자 90일)'),
  currency: z.string().optional().describe('통화 명칭 (예: 바트 (THB))'),
  currencyCode: z.string().optional().describe('통화 코드 (예: THB)'),
});

export class CreateCountryDto extends createZodDto(CreateCountrySchema) {}

export const UpdateCountrySchema = CreateCountrySchema.partial();

export class UpdateCountryDto extends createZodDto(UpdateCountrySchema) {}
