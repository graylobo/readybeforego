import { createZodDto } from '@anatine/zod-nestjs';
import { UpdateChatSettingsSchema } from '@community/shared-types';

export class UpdateChatSettingsZodDto extends createZodDto(UpdateChatSettingsSchema) {}
