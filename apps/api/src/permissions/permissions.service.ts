import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { RoleActionModule, RoleActionPermissionsData } from './permissions.types';

const ROOT_ROLE_ID = 1;

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  /**
   * Devuelve el conjunto de action codes que un rol puede EJECUTAR en un módulo.
   * El rol root (1) tiene acceso implícito a todas las acciones activas del módulo.
   * Este es el único punto de verdad para "¿qué acciones tiene permitido este rol?".
   */
  async getRoleModuleActions(roleId: number, moduleCode: string): Promise<Set<string>> {
    if (roleId === ROOT_ROLE_ID) {
      const all = await this.permissionsRepository.findModuleActionCodes(moduleCode);
      return new Set(all);
    }
    const granted = await this.permissionsRepository.findRoleActionCodes(roleId, moduleCode);
    return new Set(granted);
  }

  // Acciones agrupadas por módulo con flag granted, para la pantalla de asignación.
  async getRoleActionPermissions(roleId: number): Promise<RoleActionPermissionsData> {
    const rows = await this.permissionsRepository.findActionsWithGrant(roleId);
    const isRoot = roleId === ROOT_ROLE_ID;

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
      roleId,
      modules: Array.from(byModule.values()),
      ...(isRoot ? { implicitFullAccess: true } : {}),
    };
  }

  // Reemplaza los permisos de acción de un rol. Root no se toca (acceso implícito).
  async updateRoleActionPermissions(roleId: number, actionIds: number[]): Promise<RoleActionPermissionsData> {
    if (roleId !== ROOT_ROLE_ID) {
      const existing = await this.permissionsRepository.findExistingActionIds(actionIds);
      if (existing.length !== actionIds.length) {
        throw new PermissionsValidationError('Una o más acciones seleccionadas no existen');
      }
      await this.permissionsRepository.replaceRoleActionPermissions(roleId, actionIds);
    }
    return this.getRoleActionPermissions(roleId);
  }
}

export class PermissionsValidationError extends Error {}
