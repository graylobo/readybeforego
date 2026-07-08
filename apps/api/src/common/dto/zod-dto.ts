import { createZodDto } from '@anatine/zod-nestjs';
import {
    BanUserSchema,
    CreateBoardSchema,
    CreateCommentSchema,
    CreateEmoticonPackSchema,
    CreatePostSchema,
    ReactivateUserSchema,
    SendMessageSchema,
    SuspendUserSchema,
    TogglePostReactionSchema,
    UpdateBoardSchema,
    UpdateCommentSchema,
    UpdateEmoticonPackSchema,
    UpdateEmoticonPackStatusSchema,
    UpdatePointPolicySchema,
    UpdatePostSchema,
    UpdateUserRoleSchema,
    UpdateUserSchema,
    WarnUserSchema
} from '@community/shared-types';

// Comments
export class CreateCommentZodDto extends createZodDto(CreateCommentSchema) {}
export class UpdateCommentZodDto extends createZodDto(UpdateCommentSchema) {}

// Posts
export class CreatePostZodDto extends createZodDto(CreatePostSchema) {}
export class UpdatePostZodDto extends createZodDto(UpdatePostSchema) {}
export class TogglePostReactionZodDto extends createZodDto(TogglePostReactionSchema) {}

// Users
export class UpdateUserZodDto extends createZodDto(UpdateUserSchema) {}

// Messages
export class SendMessageZodDto extends createZodDto(SendMessageSchema) {}

// Points
export class UpdatePointPolicyZodDto extends createZodDto(UpdatePointPolicySchema) {}

// Admin / Moderation
export class WarnUserZodDto extends createZodDto(WarnUserSchema) {}
export class SuspendUserZodDto extends createZodDto(SuspendUserSchema) {}
export class BanUserZodDto extends createZodDto(BanUserSchema) {}
export class ReactivateUserZodDto extends createZodDto(ReactivateUserSchema) {}
export class UpdateUserRoleZodDto extends createZodDto(UpdateUserRoleSchema) {}

// Boards
export class CreateBoardZodDto extends createZodDto(CreateBoardSchema) {}
export class UpdateBoardZodDto extends createZodDto(UpdateBoardSchema) {}

// Emoticons
export class CreateEmoticonPackZodDto extends createZodDto(CreateEmoticonPackSchema) {}
export class UpdateEmoticonPackZodDto extends createZodDto(UpdateEmoticonPackSchema) {}
export class UpdateEmoticonPackStatusZodDto extends createZodDto(UpdateEmoticonPackStatusSchema) {}
