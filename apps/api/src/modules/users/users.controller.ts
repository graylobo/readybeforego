import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateUserZodDto } from '../../common/dto/zod-dto';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: any) {
    return this.usersService.findById(req.user.id);
  }

  @Get(':id/public')
  async getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @Patch('me')
  @ApiOperation({ summary: '내 프로필 수정' })
  @ApiBody({ type: UpdateUserZodDto })
  @UseGuards(AuthGuard('jwt'))
  @UsePipes(new ZodValidationPipe(UpdateUserZodDto))
  async updateProfile(@Req() req: any, @Body() data: UpdateUserZodDto) {
     return this.usersService.update(req.user.id, data);
  }

  @Delete('me')
  @UseGuards(AuthGuard('jwt'))
  async deleteMe(@Req() req: any) {
    return this.usersService.delete(req.user.id);
  }
}
