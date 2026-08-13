import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AuthUser, RequestUser } from '../auth/auth-user.decorator';
import { AuthGuard } from '../auth/auth.guard';
import { MenusService } from './menus.service';
import { SystemMenuPayload, SystemMenuStatusPayload } from './menus.types';

@Controller('menus')
export class MenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get()
  @UseGuards(AuthGuard)
  getMenus(@AuthUser() user: RequestUser) {
    return this.menusService.getMenusForRole(user.roleId);
  }
}

@Controller('system/menus')
@UseGuards(AuthGuard, AdminRoleGuard)
export class SystemMenusController {
  constructor(private readonly menusService: MenusService) {}

  @Get()
  listMenus() {
    return this.menusService.listSystemMenus();
  }

  @Get(':id')
  getMenu(@Param('id') id: string) {
    return this.menusService.getSystemMenu(id);
  }

  @Post()
  createMenu(@Body() payload: SystemMenuPayload) {
    return this.menusService.createSystemMenu(payload);
  }

  @Patch(':id')
  updateMenu(@Param('id') id: string, @Body() payload: SystemMenuPayload) {
    return this.menusService.updateSystemMenu(id, payload);
  }

  @Patch(':id/status')
  updateMenuStatus(@Param('id') id: string, @Body() payload: SystemMenuStatusPayload) {
    return this.menusService.updateSystemMenuStatus(id, payload);
  }
}
