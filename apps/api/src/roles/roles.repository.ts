import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2';
import { DbService } from '../db/db.service';
import { RoleExistsRow, RoleMenuPermissionRow, RoleRow } from './roles.types';

@Injectable()
export class RolesRepository {
  constructor(private readonly db: DbService) {}

  async findAllRoles(): Promise<RoleRow[]> {
    return this.db.execute<RoleRow[]>(
      `SELECT
        r.id_roles AS id,
        r.description,
        r.status,
        CASE WHEN r.status = 1 THEN 1 ELSE 0 END AS isActive,
        r.last_update AS lastUpdate,
        r.modified_by AS modifiedBy,
        COUNT(DISTINCT u.id_users) AS usersCount,
        COUNT(DISTINCT p.menu_id) AS appMenuPermissionsCount
      FROM sys_roles r
      LEFT JOIN sys_users u ON u.rol = r.id_roles
      LEFT JOIN app_role_menu_permissions p ON p.role_id = r.id_roles
      WHERE r.status IN (1, 2)
      GROUP BY r.id_roles, r.description, r.status, r.last_update, r.modified_by
      ORDER BY r.description, r.id_roles`,
    );
  }

  async findRoleById(id: number): Promise<RoleRow | null> {
    const rows = await this.db.execute<RoleRow[]>(
      `SELECT
        r.id_roles AS id,
        r.description,
        r.status,
        CASE WHEN r.status = 1 THEN 1 ELSE 0 END AS isActive,
        r.last_update AS lastUpdate,
        r.modified_by AS modifiedBy,
        COUNT(DISTINCT u.id_users) AS usersCount,
        COUNT(DISTINCT p.menu_id) AS appMenuPermissionsCount
      FROM sys_roles r
      LEFT JOIN sys_users u ON u.rol = r.id_roles
      LEFT JOIN app_role_menu_permissions p ON p.role_id = r.id_roles
      WHERE r.id_roles = ?
        AND r.status IN (1, 2)
      GROUP BY r.id_roles, r.description, r.status, r.last_update, r.modified_by
      LIMIT 1`,
      [id],
    );

    return rows[0] ?? null;
  }

  async findRoleIdByDescription(description: string): Promise<number | null> {
    const rows = await this.db.execute<RoleExistsRow[]>(
      `SELECT id_roles AS id
      FROM sys_roles
      WHERE UPPER(TRIM(description)) = UPPER(TRIM(?))
      LIMIT 1`,
      [description],
    );

    return rows[0]?.id ?? null;
  }

  async createRole(role: { description: string; isActive: boolean }): Promise<number> {
    const result = await this.db.execute<ResultSetHeader>(
      `INSERT INTO sys_roles (description, status, last_update, modified_by)
      VALUES (?, ?, NOW(), ?)`,
      [role.description, role.isActive ? 1 : 2, null],
    );

    return result.insertId;
  }

  async updateRole(id: number, role: { description: string; isActive: boolean }): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE sys_roles
      SET description = ?,
        status = ?,
        last_update = NOW(),
        modified_by = ?
      WHERE id_roles = ?
        AND status IN (1, 2)`,
      [role.description, role.isActive ? 1 : 2, null, id],
    );
  }

  async updateRoleStatus(id: number, isActive: boolean): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE sys_roles
      SET status = ?,
        last_update = NOW(),
        modified_by = ?
      WHERE id_roles = ?
        AND status IN (1, 2)`,
      [isActive ? 1 : 2, null, id],
    );
  }

  async findMenuPermissionsForRole(roleId: number): Promise<RoleMenuPermissionRow[]> {
    return this.db.execute<RoleMenuPermissionRow[]>(
      `SELECT
        m.id,
        m.code,
        m.label,
        m.parent_id AS parentId,
        m.route,
        CASE WHEN p.role_id IS NULL THEN 0 ELSE p.can_view END AS canView
      FROM app_menus m
      LEFT JOIN app_role_menu_permissions p
        ON p.menu_id = m.id
        AND p.role_id = ?
      WHERE m.is_active = 1
      ORDER BY
        COALESCE(m.parent_id, 0),
        m.sort_order,
        m.label,
        m.id`,
      [roleId],
    );
  }

  async findExistingMenuIds(menuIds: number[]): Promise<number[]> {
    if (!menuIds.length) {
      return [];
    }

    const placeholders = menuIds.map(() => '?').join(', ');
    const rows = await this.db.execute<RoleExistsRow[]>(
      `SELECT id FROM app_menus WHERE id IN (${placeholders})`,
      menuIds,
    );

    return rows.map((row) => row.id);
  }

  async replaceMenuPermissions(roleId: number, menuIds: number[]): Promise<void> {
    await this.db.transaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        'DELETE FROM app_role_menu_permissions WHERE role_id = ?',
        [roleId],
      );

      if (!menuIds.length) {
        return;
      }

      const placeholders = menuIds.map(() => '(?, ?, 1)').join(', ');
      const params = menuIds.flatMap((menuId) => [roleId, menuId]);

      await connection.execute<ResultSetHeader>(
        `INSERT INTO app_role_menu_permissions (role_id, menu_id, can_view)
        VALUES ${placeholders}`,
        params,
      );
    });
  }
}
