import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const UpdateSiteSettingsSchema = z.object({
  showSidebarAds: z.boolean().optional(),
  showAllBoardMenu: z.boolean().optional(),
  showBoardDirectoryMenu: z.boolean().optional(),
});
export class UpdateSiteSettingsZodDto extends createZodDto(UpdateSiteSettingsSchema) {}
