import { Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AuthGuard } from '../auth/auth.guard';
import { SystemUsersService } from './system-users.service';
import { SystemUserPayload, SystemUserStatusPayload } from './system-users.types';

const AVATAR_MAX_SIZE = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Controller('system/users')
@UseGuards(AuthGuard, AdminRoleGuard)
export class SystemUsersController {
  constructor(private readonly systemUsersService: SystemUsersService) {}

  @Get()
  listUsers() {
    return this.systemUsersService.listUsers();
  }

  @Get('options')
  getOptions() {
    return this.systemUsersService.getOptions();
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.systemUsersService.getUser(id);
  }

  @Post()
  createUser(@Body() payload: SystemUserPayload) {
    return this.systemUsersService.createUser(payload);
  }

  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() payload: SystemUserPayload) {
    return this.systemUsersService.updateUser(id, payload);
  }

  @Patch(':id/status')
  updateUserStatus(@Param('id') id: string, @Body() payload: SystemUserStatusPayload) {
    return this.systemUsersService.updateUserStatus(id, payload);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    limits: { fileSize: AVATAR_MAX_SIZE },
    fileFilter: (_request, file, callback) => callback(null, AVATAR_MIME_TYPES.has(file.mimetype)),
  }))
  uploadAvatar(@Param('id') id: string, @UploadedFile() avatar: any) {
    return this.systemUsersService.uploadAvatar(id, avatar);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string) {
    return this.systemUsersService.resetPassword(id);
  }
}
