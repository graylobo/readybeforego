import { createZodDto } from '@anatine/zod-nestjs';
import { z } from 'zod';

export const UpdateSiteSettingsSchema = z.object({
  showSidebarAds: z.boolean().optional(),
  showAllBoardMenu: z.boolean().optional(),
  showBoardDirectoryMenu: z.boolean().optional(),
  allBoardName: z.string().trim().min(1).max(50).optional(),
  allBoardDescription: z.string().trim().max(200).optional(),
  allBoardViewMode: z.enum(['list', 'lounge', 'feed']).optional(),
});
export class UpdateSiteSettingsZodDto extends createZodDto(UpdateSiteSettingsSchema) {}
