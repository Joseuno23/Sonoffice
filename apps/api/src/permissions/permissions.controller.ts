import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AdminRoleGuard } from '../auth/admin-role.guard';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsService, PermissionsValidationError } from './permissions.service';

@Controller('system/roles')
@UseGuards(AuthGuard, AdminRoleGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get(':id/action-permissions')
  async getActionPermissions(@Param('id') id: string) {
    const roleId = this.toRoleId(id);
    if (!roleId) return this.invalidRole();

    try {
      const data = await this.permissionsService.getRoleActionPermissions(roleId);
      return { success: true, data, message: null };
    } catch (error) {
      return this.handleError(error);
    }
  }

  @Put(':id/action-permissions')
  async updateActionPermissions(@Param('id') id: string, @Body() payload: { actionIds?: unknown }) {
    const roleId = this.toRoleId(id);
    if (!roleId) return this.invalidRole();

    const actionIds = this.normalizeActionIds(payload?.actionIds);
    if (actionIds === null) {
      return { success: false, data: null, message: 'Los permisos de acción son inválidos', errorCode: 'ROLE_INVALID_ACTION_PERMISSIONS' };
    }

    try {
      const data = await this.permissionsService.updateRoleActionPermissions(roleId, actionIds);
      return { success: true, data, message: 'Permisos de acción actualizados correctamente' };
    } catch (error) {
      if (error instanceof PermissionsValidationError) {
        return { success: false, data: null, message: error.message, errorCode: 'ROLE_ACTION_NOT_FOUND' };
      }
      return this.handleError(error);
    }
  }

  private toRoleId(value: string): number | null {
    const parsed = Number(String(value).trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private normalizeActionIds(value: unknown): number[] | null {
    if (!Array.isArray(value)) return null;
    const ids = new Set<number>();
    for (const item of value) {
      const parsed = Number(item);
      if (!Number.isInteger(parsed) || parsed <= 0) return null;
      ids.add(parsed);
    }
    return Array.from(ids);
  }

  private invalidRole() {
    return { success: false, data: null, message: 'Rol inválido', errorCode: 'INVALID_ROLE' };
  }

  private handleError(error: unknown) {
    if (typeof error === 'object' && error !== null && ('code' in error || 'errno' in error || 'sqlState' in error)) {
      const dbError = error as Record<string, unknown>;
      console.error('Action permissions database error', { code: dbError.code, errno: dbError.errno, sqlState: dbError.sqlState });
      return { success: false, data: null, message: 'No se pudo procesar los permisos en este momento', errorCode: 'PERMISSIONS_SERVER_ERROR' };
    }
    throw error;
  }
}
