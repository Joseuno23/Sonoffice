import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2';
import { DbService } from '../db/db.service';
import { MenuExistsRow, MenuRow, SystemMenuRow } from './menus.types';

@Injectable()
export class MenusRepository {
  constructor(private readonly db: DbService) {}

  async findVisibleMenusByRole(roleId: number): Promise<MenuRow[]> {
    return this.db.execute<MenuRow[]>(
      `SELECT
        m.id,
        m.parent_id,
        m.code,
        m.label,
        m.route,
        m.icon,
        m.sort_order
      FROM app_menus m
      INNER JOIN app_role_menu_permissions p ON p.menu_id = m.id
      WHERE p.role_id = ?
        AND p.can_view = 1
        AND m.is_active = 1
      ORDER BY
        COALESCE(m.parent_id, 0),
        m.sort_order,
        m.label,
        m.id`,
      [roleId],
    );
  }

  async findAllActiveMenus(): Promise<MenuRow[]> {
    return this.db.execute<MenuRow[]>(
      `SELECT
        m.id,
        m.parent_id,
        m.code,
        m.label,
        m.route,
        m.icon,
        m.sort_order
      FROM app_menus m
      WHERE m.is_active = 1
      ORDER BY
        COALESCE(m.parent_id, 0),
        m.sort_order,
        m.label,
        m.id`,
    );
  }

  async findAllSystemMenus(): Promise<SystemMenuRow[]> {
    return this.db.execute<SystemMenuRow[]>(
      `SELECT
        m.id,
        m.parent_id AS parentId,
        p.label AS parentLabel,
        m.code,
        m.label,
        m.route,
        m.icon,
        m.sort_order AS sortOrder,
        m.is_active AS isActive
      FROM app_menus m
      LEFT JOIN app_menus p ON p.id = m.parent_id
      ORDER BY
        COALESCE(m.parent_id, 0),
        m.sort_order,
        m.label,
        m.id`,
    );
  }

  async findSystemMenuById(id: number): Promise<SystemMenuRow | null> {
    const rows = await this.db.execute<SystemMenuRow[]>(
      `SELECT
        m.id,
        m.parent_id AS parentId,
        p.label AS parentLabel,
        m.code,
        m.label,
        m.route,
        m.icon,
        m.sort_order AS sortOrder,
        m.is_active AS isActive
      FROM app_menus m
      LEFT JOIN app_menus p ON p.id = m.parent_id
      WHERE m.id = ?
      LIMIT 1`,
      [id],
    );

    return rows[0] ?? null;
  }

  async findMenuIdByCode(code: string): Promise<number | null> {
    const rows = await this.db.execute<MenuExistsRow[]>(
      'SELECT id FROM app_menus WHERE code = ? LIMIT 1',
      [code],
    );

    return rows[0]?.id ?? null;
  }

  async menuExists(id: number): Promise<boolean> {
    const rows = await this.db.execute<MenuExistsRow[]>(
      'SELECT id FROM app_menus WHERE id = ? LIMIT 1',
      [id],
    );

    return rows.length > 0;
  }

  async isDescendant(menuId: number, possibleDescendantId: number): Promise<boolean> {
    const rows = await this.db.query<MenuExistsRow[]>(
      `WITH RECURSIVE descendants AS (
        SELECT id
        FROM app_menus
        WHERE parent_id = ?
        UNION ALL
        SELECT m.id
        FROM app_menus m
        INNER JOIN descendants d ON m.parent_id = d.id
      )
      SELECT id
      FROM descendants
      WHERE id = ?
      LIMIT 1`,
      [menuId, possibleDescendantId],
    );

    return rows.length > 0;
  }

  async createSystemMenu(menu: {
    code: string;
    parentId: number | null;
    label: string;
    route: string | null;
    icon: string | null;
    sortOrder: number;
    isActive: boolean;
  }): Promise<number> {
    const result = await this.db.execute<ResultSetHeader>(
      `INSERT INTO app_menus
        (code, parent_id, label, route, icon, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        menu.code,
        menu.parentId,
        menu.label,
        menu.route,
        menu.icon,
        menu.sortOrder,
        menu.isActive ? 1 : 0,
      ],
    );

    return result.insertId;
  }

  async updateSystemMenu(
    id: number,
    menu: {
      code: string;
      parentId: number | null;
      label: string;
      route: string | null;
      icon: string | null;
      sortOrder: number;
      isActive: boolean;
    },
  ): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE app_menus
      SET code = ?,
        parent_id = ?,
        label = ?,
        route = ?,
        icon = ?,
        sort_order = ?,
        is_active = ?
      WHERE id = ?`,
      [
        menu.code,
        menu.parentId,
        menu.label,
        menu.route,
        menu.icon,
        menu.sortOrder,
        menu.isActive ? 1 : 0,
        id,
      ],
    );
  }

  async updateSystemMenuStatus(id: number, isActive: boolean): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      'UPDATE app_menus SET is_active = ? WHERE id = ?',
      [isActive ? 1 : 0, id],
    );
  }
}
