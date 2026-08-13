import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2';
import { DbService } from '../db/db.service';
import { ActionCodeRow, ActionRow, RoleActionRow } from './permissions.types';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly db: DbService) {}

  // Action codes que un rol puede ejecutar dentro de un módulo (solo acciones activas).
  async findRoleActionCodes(roleId: number, moduleCode: string): Promise<string[]> {
    const rows = await this.db.execute<ActionCodeRow[]>(
      `SELECT a.action_code
       FROM app_actions a
       INNER JOIN app_role_action_permissions p ON p.action_id = a.id
       WHERE a.module_code = ?
         AND a.is_active = 1
         AND p.role_id = ?
         AND p.can_execute = 1`,
      [moduleCode, roleId],
    );
    return rows.map((row) => row.action_code);
  }

  // Todas las acciones activas de un módulo (para saber qué existe, ej. root que ve todo).
  async findModuleActionCodes(moduleCode: string): Promise<string[]> {
    const rows = await this.db.execute<ActionCodeRow[]>(
      `SELECT a.action_code
       FROM app_actions a
       WHERE a.module_code = ? AND a.is_active = 1`,
      [moduleCode],
    );
    return rows.map((row) => row.action_code);
  }

  // Catálogo completo de acciones (para la UI de asignación de permisos).
  async findAllActions(): Promise<ActionRow[]> {
    return this.db.execute<ActionRow[]>(
      `SELECT
         a.id,
         a.module_code AS moduleCode,
         a.action_code AS actionCode,
         a.code,
         a.label,
         a.description,
         a.is_active AS isActive
       FROM app_actions a
       WHERE a.is_active = 1
       ORDER BY a.module_code, a.id`,
    );
  }

  // Todas las acciones activas + flag "granted" para el rol dado (LEFT JOIN por rol).
  async findActionsWithGrant(roleId: number): Promise<RoleActionRow[]> {
    return this.db.execute<RoleActionRow[]>(
      `SELECT
         a.id,
         a.module_code AS moduleCode,
         a.code,
         a.label,
         p.can_execute AS granted
       FROM app_actions a
       LEFT JOIN app_role_action_permissions p
         ON p.action_id = a.id AND p.role_id = ?
       WHERE a.is_active = 1
       ORDER BY a.module_code, a.id`,
      [roleId],
    );
  }

  // IDs de acciones existentes y activas (validación antes de asignar).
  async findExistingActionIds(actionIds: number[]): Promise<number[]> {
    if (actionIds.length === 0) return [];
    const placeholders = actionIds.map(() => '?').join(', ');
    const rows = await this.db.execute<ActionRow[]>(
      `SELECT id FROM app_actions WHERE is_active = 1 AND id IN (${placeholders})`,
      actionIds,
    );
    return rows.map((row) => Number(row.id));
  }

  // Reemplaza atómicamente el set de permisos de acción de un rol.
  async replaceRoleActionPermissions(roleId: number, actionIds: number[]): Promise<void> {
    await this.db.transaction(async (connection) => {
      await connection.execute('DELETE FROM app_role_action_permissions WHERE role_id = ?', [roleId]);
      if (actionIds.length === 0) return;
      const values = actionIds.map(() => '(?, ?, 1)').join(', ');
      const params: number[] = [];
      for (const actionId of actionIds) {
        params.push(roleId, actionId);
      }
      await connection.execute<ResultSetHeader>(
        `INSERT INTO app_role_action_permissions (role_id, action_id, can_execute) VALUES ${values}`,
        params,
      );
    });
  }
}
