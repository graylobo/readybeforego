import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const UpdateSiteSettingsSchema = z.object({
  showSidebarAds: z.boolean().optional(),
});
export class UpdateSiteSettingsZodDto extends createZodDto(UpdateSiteSettingsSchema) {}
