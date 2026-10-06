import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { RoleActionModule, RoleActionPermissionsData } from './permissions.types';

const ROOT_ROLE_ID = 1;
const ROOT_MODULE_ACTION_FALLBACKS: Record<string, string[]> = {
  'cost-orders': ['create', 'duplicate', 'compensate', 'edit', 'finish', 'replace', 'print', 'add-obs', 'anule'],
  'external-production-budgets': ['create', 'edit', 'print', 'print-order', 'support', 'duplicate', 'replace', 'add-order', 'anule', 'view-anule'],
  'internal-production-budgets': ['create', 'edit', 'print', 'support', 'duplicate', 'replace', 'add-order', 'anule', 'view-anule'],
};

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  /**
   * Devuelve el conjunto de action codes que un rol puede EJECUTAR en un módulo.
   * El rol root (1) tiene acceso implícito a todas las acciones activas del módulo.
   * Este es el único punto de verdad para "¿qué acciones tiene permitido este rol?".
   */
  async getRoleModuleActions(roleId: unknown, moduleCode: string): Promise<Set<string>> {
    const normalizedRoleId = this.toPositiveInteger(roleId);
    if (normalizedRoleId === ROOT_ROLE_ID) {
      const all = await this.permissionsRepository.findModuleActionCodes(moduleCode);
      return new Set([...all, ...(ROOT_MODULE_ACTION_FALLBACKS[moduleCode] ?? [])]);
    }
    if (!normalizedRoleId) return new Set();
    const granted = await this.permissionsRepository.findRoleActionCodes(normalizedRoleId, moduleCode);
    return new Set(granted);
  }

  async hasMenuAccess(roleId: unknown, menuCodes: string[]): Promise<boolean> {
    const normalizedRoleId = this.toPositiveInteger(roleId);
    if (normalizedRoleId === ROOT_ROLE_ID) return true;
    if (!normalizedRoleId) return false;
    return this.permissionsRepository.hasRoleMenuAccess(normalizedRoleId, menuCodes);
  }

  // Acciones agrupadas por módulo con flag granted, para la pantalla de asignación.
  async getRoleActionPermissions(roleId: unknown): Promise<RoleActionPermissionsData> {
    const normalizedRoleId = this.toPositiveInteger(roleId) ?? 0;
    const rows = await this.permissionsRepository.findActionsWithGrant(normalizedRoleId);
    const isRoot = normalizedRoleId === ROOT_ROLE_ID;

    const byModule = new Map<string, RoleActionModule>();
    for (const row of rows) {
      if (!byModule.has(row.moduleCode)) {
        byModule.set(row.moduleCode, { moduleCode: row.moduleCode, actions: [] });
      }
      byModule.get(row.moduleCode)!.actions.push({
        id: Number(row.id),
        code: row.code,
        label: row.label,
        granted: isRoot || row.granted === 1,
      });
    }

    return {
      roleId: normalizedRoleId,
      modules: Array.from(byModule.values()),
      ...(isRoot ? { implicitFullAccess: true } : {}),
    };
  }

  // Reemplaza los permisos de acción de un rol. Root no se toca (acceso implícito).
  async updateRoleActionPermissions(roleId: unknown, actionIds: number[]): Promise<RoleActionPermissionsData> {
    const normalizedRoleId = this.toPositiveInteger(roleId);
    if (!normalizedRoleId) throw new PermissionsValidationError('Rol inválido');
    if (normalizedRoleId !== ROOT_ROLE_ID) {
      const existing = await this.permissionsRepository.findExistingActionIds(actionIds);
      if (existing.length !== actionIds.length) {
        throw new PermissionsValidationError('Una o más acciones seleccionadas no existen');
      }
      await this.permissionsRepository.replaceRoleActionPermissions(normalizedRoleId, actionIds);
    }
    return this.getRoleActionPermissions(normalizedRoleId);
  }

  private toPositiveInteger(value: unknown): number | null {
    const roleId = Number(value);
    return Number.isInteger(roleId) && roleId > 0 ? roleId : null;
  }
}

export class PermissionsValidationError extends Error {}
