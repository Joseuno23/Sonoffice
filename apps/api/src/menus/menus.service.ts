import { Injectable } from '@nestjs/common';
import { MenusRepository } from './menus.repository';
import {
  MenuItem,
  MenuRow,
  MenusResponse,
  SystemMenuPayload,
  SystemMenuResponse,
  SystemMenuRow,
  SystemMenuStatusPayload,
} from './menus.types';

const INVALID_ROLE_RESPONSE: MenusResponse = {
  success: false,
  data: null,
  message: 'Rol inválido',
  errorCode: 'INVALID_ROLE',
};

const MENUS_SERVER_ERROR_RESPONSE: MenusResponse = {
  success: false,
  data: null,
  message: 'No se pudo cargar el menú en este momento',
  errorCode: 'MENUS_SERVER_ERROR',
};

const ROOT_ROLE_ID = 1;

@Injectable()
export class MenusService {
  constructor(private readonly menusRepository: MenusRepository) {}

  async getMenusForRole(rawRoleId: unknown): Promise<MenusResponse> {
    const roleId = this.toPositiveInteger(rawRoleId);

    if (!roleId) {
      return INVALID_ROLE_RESPONSE;
    }

    try {
      const rows = roleId === ROOT_ROLE_ID
        ? await this.menusRepository.findAllActiveMenus()
        : await this.menusRepository.findVisibleMenusByRole(roleId);

      return {
        success: true,
        data: this.buildTree(rows),
        message: null,
      };
    } catch (error) {
      if (this.isDatabaseError(error)) {
        console.error('Menus database error', this.toSafeDatabaseError(error));
        return MENUS_SERVER_ERROR_RESPONSE;
      }

      throw error;
    }
  }

  async listSystemMenus(): Promise<SystemMenuResponse<SystemMenuRow[]>> {
    try {
      const rows = await this.menusRepository.findAllSystemMenus();
      return { success: true, data: rows.map((row) => this.normalizeSystemMenu(row)), message: null };
    } catch (error) {
      return this.handleSystemMenusError(error);
    }
  }

  async getSystemMenu(rawId: unknown): Promise<SystemMenuResponse<SystemMenuRow>> {
    const id = this.toPositiveInteger(rawId);

    if (!id) {
      return this.menuNotFoundResponse();
    }

    try {
      const row = await this.menusRepository.findSystemMenuById(id);

      if (!row) {
        return this.menuNotFoundResponse();
      }

      return { success: true, data: this.normalizeSystemMenu(row), message: null };
    } catch (error) {
      return this.handleSystemMenusError(error);
    }
  }

  async createSystemMenu(payload: SystemMenuPayload): Promise<SystemMenuResponse<SystemMenuRow>> {
    const normalized = this.normalizePayload(payload);
    const validationError = this.validatePayload(normalized);

    if (validationError) {
      return validationError;
    }

    try {
      const parentError = await this.validateParent(normalized.parentId);
      if (parentError) return parentError;

      const existingCodeId = await this.menusRepository.findMenuIdByCode(normalized.code);
      if (existingCodeId) {
        return this.duplicateCodeResponse();
      }

      const id = await this.menusRepository.createSystemMenu(normalized);
      const row = await this.menusRepository.findSystemMenuById(id);

      return {
        success: true,
        data: this.normalizeSystemMenu(row),
        message: 'Menú creado correctamente',
      };
    } catch (error) {
      return this.handleSystemMenusError(error);
    }
  }

  async updateSystemMenu(rawId: unknown, payload: SystemMenuPayload): Promise<SystemMenuResponse<SystemMenuRow>> {
    const id = this.toPositiveInteger(rawId);

    if (!id) {
      return this.menuNotFoundResponse();
    }

    const normalized = this.normalizePayload(payload);
    const validationError = this.validatePayload(normalized);

    if (validationError) {
      return validationError;
    }

    if (normalized.parentId === id) {
      return {
        success: false,
        data: null,
        message: 'Un menú no puede ser su propio padre',
        errorCode: 'MENU_PARENT_SELF_REFERENCE',
      };
    }

    try {
      const current = await this.menusRepository.findSystemMenuById(id);
      if (!current) {
        return this.menuNotFoundResponse();
      }

      const parentError = await this.validateParent(normalized.parentId);
      if (parentError) return parentError;

      if (normalized.parentId) {
        const descendantParent = await this.menusRepository.isDescendant(id, normalized.parentId);
        if (descendantParent) {
          return {
            success: false,
            data: null,
            message: 'No se puede asignar un menú descendiente como padre',
            errorCode: 'MENU_PARENT_DESCENDANT',
          };
        }
      }

      const existingCodeId = await this.menusRepository.findMenuIdByCode(normalized.code);
      if (existingCodeId && existingCodeId !== id) {
        return this.duplicateCodeResponse();
      }

      await this.menusRepository.updateSystemMenu(id, normalized);
      const row = await this.menusRepository.findSystemMenuById(id);

      return {
        success: true,
        data: this.normalizeSystemMenu(row),
        message: 'Menú actualizado correctamente',
      };
    } catch (error) {
      return this.handleSystemMenusError(error);
    }
  }

  async updateSystemMenuStatus(
    rawId: unknown,
    payload: SystemMenuStatusPayload,
  ): Promise<SystemMenuResponse<SystemMenuRow>> {
    const id = this.toPositiveInteger(rawId);

    if (!id) {
      return this.menuNotFoundResponse();
    }

    const isActive = this.toBoolean(payload?.isActive);

    if (isActive === null) {
      return {
        success: false,
        data: null,
        message: 'El estado del menú es inválido',
        errorCode: 'MENU_INVALID_STATUS',
      };
    }

    try {
      const current = await this.menusRepository.findSystemMenuById(id);
      if (!current) {
        return this.menuNotFoundResponse();
      }

      await this.menusRepository.updateSystemMenuStatus(id, isActive);
      const row = await this.menusRepository.findSystemMenuById(id);

      return {
        success: true,
        data: this.normalizeSystemMenu(row),
        message: isActive ? 'Menú activado correctamente' : 'Menú desactivado correctamente',
      };
    } catch (error) {
      return this.handleSystemMenusError(error);
    }
  }

  private toPositiveInteger(value: unknown): number | null {
    if (Array.isArray(value)) {
      return null;
    }

    const normalized = typeof value === 'string' ? value.trim() : value;

    if (normalized === '' || normalized === null || normalized === undefined) {
      return null;
    }

    const roleId = Number(normalized);

    if (!Number.isInteger(roleId) || roleId <= 0) {
      return null;
    }

    return roleId;
  }

  private buildTree(rows: MenuRow[]): MenuItem[] {
    const byId = new Map<number, MenuItem>();
    const roots: MenuItem[] = [];

    for (const row of rows) {
      byId.set(row.id, {
        id: row.id,
        code: row.code,
        label: row.label,
        route: row.route,
        icon: row.icon,
        children: [],
      });
    }

    for (const row of rows) {
      const item = byId.get(row.id);
      if (!item) continue;

      const parent = row.parent_id ? byId.get(row.parent_id) : null;

      if (parent) {
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  }

  private normalizePayload(payload: SystemMenuPayload) {
    return {
      code: this.toTrimmedString(payload?.code),
      parentId: this.toNullablePositiveInteger(payload?.parentId),
      label: this.toTrimmedString(payload?.label),
      route: this.toNullableString(payload?.route),
      icon: this.toNullableString(payload?.icon),
      sortOrder: this.toInteger(payload?.sortOrder, 0),
      isActive: this.toBoolean(payload?.isActive) ?? true,
    };
  }

  private validatePayload(payload: ReturnType<MenusService['normalizePayload']>): SystemMenuResponse<null> | null {
    if (!payload.code) {
      return {
        success: false,
        data: null,
        message: 'El código del menú es obligatorio',
        errorCode: 'MENU_CODE_REQUIRED',
      };
    }

    if (!payload.label) {
      return {
        success: false,
        data: null,
        message: 'El nombre del menú es obligatorio',
        errorCode: 'MENU_LABEL_REQUIRED',
      };
    }

    if (!Number.isInteger(payload.sortOrder)) {
      return {
        success: false,
        data: null,
        message: 'El orden debe ser un número entero',
        errorCode: 'MENU_INVALID_SORT_ORDER',
      };
    }

    return null;
  }

  private async validateParent(parentId: number | null): Promise<SystemMenuResponse<null> | null> {
    if (!parentId) {
      return null;
    }

    const exists = await this.menusRepository.menuExists(parentId);
    if (!exists) {
      return {
        success: false,
        data: null,
        message: 'El menú padre seleccionado no existe',
        errorCode: 'MENU_PARENT_NOT_FOUND',
      };
    }

    return null;
  }

  private normalizeSystemMenu(row: SystemMenuRow): SystemMenuRow {
    return {
      ...row,
      parentId: row.parentId ?? null,
      parentLabel: row.parentLabel ?? null,
      route: row.route ?? null,
      icon: row.icon ?? null,
      sortOrder: Number(row.sortOrder ?? 0),
      isActive: row.isActive === true || row.isActive === 1,
    };
  }

  private toTrimmedString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private toNullableString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  private toNullablePositiveInteger(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return this.toPositiveInteger(value);
  }

  private toInteger(value: unknown, fallback: number): number {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : Number.NaN;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    if (value === null || value === undefined || value === '') return null;
    return null;
  }

  private menuNotFoundResponse(): SystemMenuResponse<null> {
    return {
      success: false,
      data: null,
      message: 'Menú no encontrado',
      errorCode: 'MENU_NOT_FOUND',
    };
  }

  private duplicateCodeResponse(): SystemMenuResponse<null> {
    return {
      success: false,
      data: null,
      message: 'Ya existe un menú con ese código',
      errorCode: 'MENU_CODE_EXISTS',
    };
  }

  private handleSystemMenusError(error: unknown): SystemMenuResponse<null> {
    if (this.isDuplicateCodeError(error)) {
      return this.duplicateCodeResponse();
    }

    if (this.isDatabaseError(error)) {
      console.error('System menus database error', this.toSafeDatabaseError(error));
      return {
        success: false,
        data: null,
        message: 'No se pudo procesar el menú en este momento',
        errorCode: 'MENUS_SERVER_ERROR',
      };
    }

    throw error;
  }

  private isDuplicateCodeError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const databaseError = error as Record<string, unknown>;
    return databaseError.code === 'ER_DUP_ENTRY';
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
