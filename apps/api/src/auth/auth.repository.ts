import { Injectable } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { DbService } from '../db/db.service';

export interface LegacyLoginUserRow extends RowDataPacket {
  id_users: number;
  id_users_medios: number | null;
  name: string;
  rol: number;
  description: string;
  email: string | null;
  avatar: string | null;
  skin: string | null;
  layout: string | null;
  sidebar: string | null;
  ip: string | null;
  mac_address: string | null;
  last_date: Date | string | null;
  activ: number;
}

export interface PasswordRecoveryUserRow extends RowDataPacket {
  id_users: number;
  name: string;
  email: string | null;
  password: string;
  last_date: Date | string | null;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly db: DbService) {}

  async findLegacyUserByCredentials(
    username: string,
    passwordHash: string,
  ): Promise<LegacyLoginUserRow | null> {
    const rows = await this.db.execute<LegacyLoginUserRow[]>(
      `SELECT
        *,
        u.status AS activ
      FROM sys_users u
      JOIN sys_roles r ON u.rol = r.id_roles
      LEFT JOIN sys_preferences_html p ON u.id_users = p.id_users
       WHERE (u.user = ? OR u.email = ?) AND u.password = ?
       LIMIT 1`,
      [username, username, passwordHash],
    );

    return rows[0] ?? null;
  }

  async hasTimesheets(userId: number): Promise<number> {
    const rows = await this.db.execute<RowDataPacket[]>(
      'SELECT 1 AS has_timesheet FROM sys_timesheet WHERE id_users = ? LIMIT 1',
      [userId],
    );

    return rows.length;
  }

  async updateLegacyUserPassword(userId: number, passwordHash: string): Promise<number> {
    const result = await this.db.execute<ResultSetHeader>(
      `UPDATE sys_users
       SET password = ?, last_date = NOW()
       WHERE id_users = ? AND DATEDIFF(CURDATE(), DATE(last_date)) > 60`,
      [passwordHash, userId],
    );

    return result.affectedRows;
  }

  async findActiveUserForPasswordRecovery(email: string): Promise<PasswordRecoveryUserRow | null> {
    const rows = await this.db.execute<PasswordRecoveryUserRow[]>(
      `SELECT id_users, name, email, password, last_date
       FROM sys_users
       WHERE status = 1 AND (email = ? OR user = ?)
       LIMIT 1`,
      [email, email],
    );

    return rows[0] ?? null;
  }

  async setTemporaryPasswordForRecovery(userId: number, passwordHash: string): Promise<number> {
    const result = await this.db.execute<ResultSetHeader>(
      `UPDATE sys_users
       SET password = ?, last_date = DATE_SUB(NOW(), INTERVAL 61 DAY)
       WHERE id_users = ? AND status = 1`,
      [passwordHash, userId],
    );

    return result.affectedRows;
  }

  async restorePasswordRecoveryState(
    userId: number,
    previousPasswordHash: string,
    previousLastDate: Date | string | null,
  ): Promise<number> {
    const result = await this.db.execute<ResultSetHeader>(
      `UPDATE sys_users
       SET password = ?, last_date = ?
       WHERE id_users = ? AND status = 1`,
      [previousPasswordHash, previousLastDate, userId],
    );

    return result.affectedRows;
  }
}
