import { Injectable } from '@nestjs/common';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { DbService } from '../db/db.service';
import { SystemUserExistsRow, SystemUserOptionRow, SystemUserRow } from './system-users.types';

const DEFAULT_PASSWORD = '123456789';
const FORCE_CHANGE_DATE = '2017-01-01';

export interface NormalizedSystemUserPayload {
  name: string;
  cc: string;
  areaId: string;
  username: string;
  email: string;
  roleId: number;
  admissionDate: string | null;
  timeSheets: number;
  avatar: string | null;
  isActive: boolean;
}

@Injectable()
export class SystemUsersRepository {
  constructor(private readonly db: DbService) {}

  async findAll(): Promise<SystemUserRow[]> {
    return this.db.execute<SystemUserRow[]>(
      `SELECT
        u.id_users AS id,
        u.id_users_medios AS legacyUserId,
        u.id_users_medios AS idUsersMedios,
        u.name,
        u.cc,
        u.id_area AS areaId,
        a.nmb_are AS areaLabel,
        u.user AS username,
        u.email,
        u.rol AS roleId,
        r.description AS roleLabel,
        u.status,
        CASE WHEN u.status = 1 THEN 1 ELSE 0 END AS isActive,
        u.admission_date AS admissionDate,
        u.time_sheets AS timeSheets,
        u.avatar
      FROM sys_users u
      LEFT JOIN sys_roles r ON r.id_roles = u.rol
      LEFT JOIN cat_area a ON CAST(a.cat_areaid AS CHAR) = u.id_area
      WHERE u.status IN (1, 2)
      ORDER BY u.name, u.id_users`,
    );
  }

  async findById(id: number): Promise<SystemUserRow | null> {
    const rows = await this.db.execute<SystemUserRow[]>(
      `SELECT
        u.id_users AS id,
        u.id_users_medios AS legacyUserId,
        u.id_users_medios AS idUsersMedios,
        u.name,
        u.cc,
        u.id_area AS areaId,
        a.nmb_are AS areaLabel,
        u.user AS username,
        u.email,
        u.rol AS roleId,
        r.description AS roleLabel,
        u.status,
        CASE WHEN u.status = 1 THEN 1 ELSE 0 END AS isActive,
        u.admission_date AS admissionDate,
        u.time_sheets AS timeSheets,
        u.avatar
      FROM sys_users u
      LEFT JOIN sys_roles r ON r.id_roles = u.rol
      LEFT JOIN cat_area a ON CAST(a.cat_areaid AS CHAR) = u.id_area
      WHERE u.id_users = ?
        AND u.status IN (1, 2)
      LIMIT 1`,
      [id],
    );

    return rows[0] ?? null;
  }

  async findByUsername(username: string, excludeId?: number): Promise<number | null> {
    const rows = await this.db.execute<SystemUserExistsRow[]>(
      `SELECT id_users AS id
      FROM sys_users
      WHERE UPPER(TRIM(user)) = UPPER(TRIM(?))
        AND (? IS NULL OR id_users <> ?)
      LIMIT 1`,
      [username, excludeId ?? null, excludeId ?? null],
    );

    return rows[0]?.id ?? null;
  }

  async findByEmail(email: string, excludeId?: number): Promise<number | null> {
    const rows = await this.db.execute<SystemUserExistsRow[]>(
      `SELECT id_users AS id
      FROM sys_users
      WHERE UPPER(TRIM(email)) = UPPER(TRIM(?))
        AND (? IS NULL OR id_users <> ?)
      LIMIT 1`,
      [email, excludeId ?? null, excludeId ?? null],
    );

    return rows[0]?.id ?? null;
  }

  async roleExists(roleId: number): Promise<boolean> {
    const rows = await this.db.execute<SystemUserExistsRow[]>(
      'SELECT id_roles AS id FROM sys_roles WHERE id_roles = ? AND status = 1 LIMIT 1',
      [roleId],
    );

    return rows.length > 0;
  }

  async areaExists(areaId: string): Promise<boolean> {
    const rows = await this.db.execute<SystemUserExistsRow[]>(
      'SELECT cat_areaid AS id FROM cat_area WHERE cat_areaid = ? AND est_are = 1 LIMIT 1',
      [areaId],
    );

    return rows.length > 0;
  }

  async create(payload: NormalizedSystemUserPayload): Promise<number> {
    return this.db.transaction(async (connection) => {
      const legacyUserId = await this.insertUsuarios(connection, payload);
      const result = await connection.execute<ResultSetHeader>(
        `INSERT INTO sys_users
          (id_users_medios, name, cc, id_area, user, password, rol, status, admission_date, email, last_date, avatar, time_sheets)
        VALUES (?, ?, ?, ?, ?, MD5(MD5(?)), ?, ?, ?, ?, ?, ?, ?)`,
        [
          legacyUserId,
          payload.name,
          payload.cc,
          payload.areaId,
          payload.username,
          DEFAULT_PASSWORD,
          payload.roleId,
          payload.isActive ? 1 : 2,
          payload.admissionDate,
          payload.email,
          FORCE_CHANGE_DATE,
          payload.avatar,
          payload.timeSheets,
        ],
      );

      return result[0].insertId;
    });
  }

  async update(id: number, payload: NormalizedSystemUserPayload): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE sys_users
      SET name = ?,
        cc = ?,
        id_area = ?,
        user = ?,
        email = ?,
        rol = ?,
        admission_date = ?,
        time_sheets = ?,
        avatar = ?,
        status = ?
      WHERE id_users = ?
        AND status IN (1, 2)`,
      [
        payload.name,
        payload.cc,
        payload.areaId,
        payload.username,
        payload.email,
        payload.roleId,
        payload.admissionDate,
        payload.timeSheets,
        payload.avatar,
        payload.isActive ? 1 : 2,
        id,
      ],
    );
  }

  async updateStatus(id: number, isActive: boolean): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE sys_users
      SET status = ?
      WHERE id_users = ?
        AND status IN (1, 2)`,
      [isActive ? 1 : 2, id],
    );
  }

  async updateAvatar(id: number, avatar: string): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE sys_users
      SET avatar = ?
      WHERE id_users = ?
        AND status IN (1, 2)`,
      [avatar, id],
    );
  }

  async resetPassword(id: number): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE sys_users
      SET password = MD5(MD5(?)),
        last_date = ?,
        recovery = NULL,
        last_send = NULL
      WHERE id_users = ?
        AND status IN (1, 2)`,
      [DEFAULT_PASSWORD, FORCE_CHANGE_DATE, id],
    );
  }

  async findActiveRoles(): Promise<SystemUserOptionRow[]> {
    return this.db.execute<SystemUserOptionRow[]>(
      `SELECT id_roles AS id, description AS label
      FROM sys_roles
      WHERE status = 1
      ORDER BY description, id_roles`,
    );
  }

  async findActiveAreas(): Promise<SystemUserOptionRow[]> {
    return this.db.execute<SystemUserOptionRow[]>(
      `SELECT cat_areaid AS id, nmb_are AS label
      FROM cat_area
      WHERE est_are = 1
      ORDER BY nmb_are, cat_areaid`,
    );
  }

  private async insertUsuarios(connection: PoolConnection, payload: NormalizedSystemUserPayload): Promise<number> {
    const [firstName, ...lastNameParts] = payload.name.split(/\s+/);
    const lastName = lastNameParts.join(' ');

    const result = await connection.execute<ResultSetHeader>(
      `INSERT INTO usuarios
        (usr_docid, usr_nombre, usr_apellido, usr_email, usr_usuario, usr_psw, usr_perfil, usr_area, usr_fecha, usr_id_crea, est_id, cambio, fecha_cambio)
      VALUES (?, ?, ?, ?, ?, MD5(MD5(?)), ?, ?, NOW(), 0, ?, 1, ?)`,
      [
        payload.cc,
        firstName || payload.name,
        lastName,
        payload.email,
        payload.username,
        DEFAULT_PASSWORD,
        payload.roleId,
        payload.areaId,
        payload.isActive ? 1 : 2,
        FORCE_CHANGE_DATE,
      ],
    );

    return result[0].insertId;
  }
}
