import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RolesService } from './roles.service';
import { MenuPermissionPayload, RolePayload, RoleStatusPayload } from './roles.types';

@Controller('system/roles')
@UseGuards(AuthGuard, AdminRoleGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  listRoles() {
    return this.rolesService.listRoles();
  }

  @Get(':id')
  getRole(@Param('id') id: string) {
    return this.rolesService.getRole(id);
  }

  @Get(':id/menu-permissions')
  getMenuPermissions(@Param('id') id: string) {
    return this.rolesService.getMenuPermissions(id);
  }

  @Post()
  createRole(@Body() payload: RolePayload) {
    return this.rolesService.createRole(payload);
  }

  @Patch(':id')
  updateRole(@Param('id') id: string, @Body() payload: RolePayload) {
    return this.rolesService.updateRole(id, payload);
  }

  @Patch(':id/status')
  updateRoleStatus(@Param('id') id: string, @Body() payload: RoleStatusPayload) {
    return this.rolesService.updateRoleStatus(id, payload);
  }

  @Put(':id/menu-permissions')
  updateMenuPermissions(@Param('id') id: string, @Body() payload: MenuPermissionPayload) {
    return this.rolesService.updateMenuPermissions(id, payload);
  }
}
