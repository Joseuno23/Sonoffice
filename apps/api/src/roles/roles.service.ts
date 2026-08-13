import { Injectable } from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import {
  MenuPermissionPayload,
  RoleMenuPermissionsData,
  RoleMenuPermissionRow,
  RolePayload,
  RoleResponse,
  RoleRow,
  RoleStatusPayload,
} from './roles.types';

const ROOT_ROLE_ID = 1;
const ROOT_IMPLICIT_ACCESS_MESSAGE = 'El rol administrador principal tiene acceso total automáticamente';

@Injectable()
export class RolesService {
  constructor(private readonly rolesRepository: RolesRepository) {}

  async listRoles(): Promise<RoleResponse<RoleRow[]>> {
    try {
      const rows = await this.rolesRepository.findAllRoles();
      return { success: true, data: rows.map((row) => this.normalizeRole(row)), message: null };
    } catch (error) {
      return this.handleRolesError(error);
    }
  }

  async getRole(rawId: unknown): Promise<RoleResponse<RoleRow>> {
    const id = this.toPositiveInteger(rawId);

    if (!id) {
      return this.roleNotFoundResponse();
    }

    try {
      const row = await this.rolesRepository.findRoleById(id);

      if (!row) {
        return this.roleNotFoundResponse();
      }

      return { success: true, data: this.normalizeRole(row), message: null };
    } catch (error) {
      return this.handleRolesError(error);
    }
  }

  async createRole(payload: RolePayload): Promise<RoleResponse<RoleRow>> {
    const normalized = this.normalizePayload(payload);
    const validationError = this.validatePayload(normalized);

    if (validationError) {
      return validationError;
    }

    try {
      const existingRoleId = await this.rolesRepository.findRoleIdByDescription(normalized.description);
      if (existingRoleId) {
        return this.duplicateDescriptionResponse();
      }

      const id = await this.rolesRepository.createRole(normalized);
      const row = await this.rolesRepository.findRoleById(id);

      return {
        success: true,
        data: this.normalizeRole(row),
        message: 'Rol creado correctamente',
      };
    } catch (error) {
      return this.handleRolesError(error);
    }
  }

  async updateRole(rawId: unknown, payload: RolePayload): Promise<RoleResponse<RoleRow>> {
    const id = this.toPositiveInteger(rawId);

    if (!id) {
      return this.roleNotFoundResponse();
    }

    const normalized = this.normalizePayload(payload);
    const validationError = this.validatePayload(normalized);

    if (validationError) {
      return validationError;
    }

    try {
      const current = await this.rolesRepository.findRoleById(id);
      if (!current) {
        return this.roleNotFoundResponse();
      }

      const existingRoleId = await this.rolesRepository.findRoleIdByDescription(normalized.description);
      if (existingRoleId && existingRoleId !== id) {
        return this.duplicateDescriptionResponse();
      }

      await this.rolesRepository.updateRole(id, normalized);
      const row = await this.rolesRepository.findRoleById(id);

      return {
        success: true,
        data: this.normalizeRole(row),
        message: 'Rol actualizado correctamente',
      };
    } catch (error) {
      return this.handleRolesError(error);
    }
  }

  async updateRoleStatus(rawId: unknown, payload: RoleStatusPayload): Promise<RoleResponse<RoleRow>> {
    const id = this.toPositiveInteger(rawId);

    if (!id) {
      return this.roleNotFoundResponse();
    }
    const isActive = this.toBoolean(payload?.isActive);

    if (isActive === null) {
      return {
        success: false,
        data: null,
        message: 'El estado del rol es inválido',
        errorCode: 'ROLE_INVALID_STATUS',
      };
    }

    if (id === 1 && !isActive) {
      return {
        success: false,
        data: null,
        message: 'El rol administrador principal no se puede inactivar',
        errorCode: 'ROLE_ROOT_CANNOT_BE_DISABLED',
      };
    }

    try {
      const current = await this.rolesRepository.findRoleById(id);
      if (!current) {
        return this.roleNotFoundResponse();
      }

      await this.rolesRepository.updateRoleStatus(id, isActive);
      const row = await this.rolesRepository.findRoleById(id);

      return {
        success: true,
        data: this.normalizeRole(row),
        message: isActive ? 'Rol activado correctamente' : 'Rol desactivado correctamente',
      };
    } catch (error) {
      return this.handleRolesError(error);
    }
  }

  async getMenuPermissions(rawId: unknown): Promise<RoleResponse<RoleMenuPermissionsData>> {
    const id = this.toPositiveInteger(rawId);

    if (!id) {
      return this.roleNotFoundResponse();
    }

    try {
      const current = await this.rolesRepository.findRoleById(id);
      if (!current) {
        return this.roleNotFoundResponse();
      }

      const menus = await this.rolesRepository.findMenuPermissionsForRole(id);
      const normalizedMenus = menus.map((menu) => this.normalizeMenuPermission(menu, id === ROOT_ROLE_ID));

      return {
        success: true,
        data: {
          roleId: id,
          menus: normalizedMenus,
          ...(id === ROOT_ROLE_ID ? { implicitFullAccess: true } : {}),
        },
        message: id === ROOT_ROLE_ID ? ROOT_IMPLICIT_ACCESS_MESSAGE : null,
      };
    } catch (error) {
      return this.handleRolesError(error);
    }
  }

  async updateMenuPermissions(
    rawId: unknown,
    payload: MenuPermissionPayload,
  ): Promise<RoleResponse<RoleMenuPermissionsData>> {
    const id = this.toPositiveInteger(rawId);

    if (!id) {
      return this.roleNotFoundResponse();
    }

    const menuIds = this.normalizeMenuIds(payload?.menuIds);

    if (!menuIds) {
      return {
        success: false,
        data: null,
        message: 'Los permisos de menú son inválidos',
        errorCode: 'ROLE_INVALID_MENU_PERMISSIONS',
      };
    }

    try {
      const current = await this.rolesRepository.findRoleById(id);
      if (!current) {
        return this.roleNotFoundResponse();
      }

      if (id === ROOT_ROLE_ID) {
        const menus = await this.rolesRepository.findMenuPermissionsForRole(id);
        return {
          success: true,
          data: {
            roleId: id,
            menus: menus.map((menu) => this.normalizeMenuPermission(menu, true)),
            implicitFullAccess: true,
          },
          message: ROOT_IMPLICIT_ACCESS_MESSAGE,
        };
      }

      const existingMenuIds = await this.rolesRepository.findExistingMenuIds(menuIds);
      if (existingMenuIds.length !== menuIds.length) {
        return {
          success: false,
          data: null,
          message: 'Uno o más menús seleccionados no existen',
          errorCode: 'ROLE_MENU_NOT_FOUND',
        };
      }

      await this.rolesRepository.replaceMenuPermissions(id, menuIds);
      const menus = await this.rolesRepository.findMenuPermissionsForRole(id);

      return {
        success: true,
        data: {
          roleId: id,
          menus: menus.map((menu) => this.normalizeMenuPermission(menu)),
        },
        message: 'Permisos de menú actualizados correctamente',
      };
    } catch (error) {
      return this.handleRolesError(error);
    }
  }

  private normalizePayload(payload: RolePayload) {
    return {
      description: this.toTrimmedString(payload?.description).toUpperCase(),
      isActive: this.toBoolean(payload?.isActive) ?? true,
    };
  }

  private validatePayload(payload: ReturnType<RolesService['normalizePayload']>): RoleResponse<null> | null {
    if (!payload.description) {
      return {
        success: false,
        data: null,
        message: 'La descripción del rol es obligatoria',
        errorCode: 'ROLE_DESCRIPTION_REQUIRED',
      };
    }

    if (payload.description.length > 50) {
      return {
        success: false,
        data: null,
        message: 'La descripción del rol no puede superar 50 caracteres',
        errorCode: 'ROLE_DESCRIPTION_TOO_LONG',
      };
    }

    return null;
  }

  private normalizeRole(row: RoleRow): RoleRow {
    return {
      ...row,
      description: row.description ?? '',
      status: Number(row.status),
      isActive: row.status === 1 || row.isActive === true || row.isActive === 1,
      lastUpdate: row.lastUpdate ?? null,
      modifiedBy: row.modifiedBy ?? null,
      usersCount: Number(row.usersCount ?? 0),
      appMenuPermissionsCount: Number(row.appMenuPermissionsCount ?? 0),
    };
  }

  private normalizeMenuPermission(row: RoleMenuPermissionRow, forceCanView = false): RoleMenuPermissionRow {
    return {
      ...row,
      parentId: row.parentId ?? null,
      route: row.route ?? null,
      canView: forceCanView || row.canView === true || row.canView === 1,
    };
  }

  private normalizeMenuIds(value: unknown): number[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const ids = new Set<number>();

    for (const item of value) {
      const id = this.toPositiveInteger(item);
      if (!id) {
        return null;
      }
      ids.add(id);
    }

    return Array.from(ids);
  }

  private toPositiveInteger(value: unknown): number | null {
    if (Array.isArray(value)) {
      return null;
    }

    const normalized = typeof value === 'string' ? value.trim() : value;

    if (normalized === '' || normalized === null || normalized === undefined) {
      return null;
    }

    const id = Number(normalized);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private toTrimmedString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    if (value === null || value === undefined || value === '') return null;
    return null;
  }

  private roleNotFoundResponse(): RoleResponse<null> {
    return {
      success: false,
      data: null,
      message: 'Rol no encontrado',
      errorCode: 'ROLE_NOT_FOUND',
    };
  }

  private duplicateDescriptionResponse(): RoleResponse<null> {
    return {
      success: false,
      data: null,
      message: 'Ya existe un rol con esa descripción',
      errorCode: 'ROLE_DESCRIPTION_EXISTS',
    };
  }

  private handleRolesError(error: unknown): RoleResponse<null> {
    if (this.isDatabaseError(error)) {
      console.error('Roles database error', this.toSafeDatabaseError(error));
      return {
        success: false,
        data: null,
        message: 'No se pudo procesar el rol en este momento',
        errorCode: 'ROLES_SERVER_ERROR',
      };
    }

    throw error;
  }

  private isDatabaseError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      ('code' in error || 'errno' in error || 'sqlState' in error)
    );
  }

  private toSafeDatabaseError(error: unknown): Record<string, unknown> {
    if (typeof error !== 'object' || error === null) {
      return {};
    }

    const databaseError = error as Record<string, unknown>;
    return {
      code: databaseError.code,
      errno: databaseError.errno,
      sqlState: databaseError.sqlState,
    };
  }
}
