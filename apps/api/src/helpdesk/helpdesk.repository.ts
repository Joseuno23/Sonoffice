import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2/promise';
import { DbService } from '../db/db.service';
import { HelpdeskEmailContextRow, HelpdeskMetricRow, HelpdeskNotificationRecipientRow, HelpdeskOptionRow, HelpdeskPendingRatingRow, HelpdeskTicketRow } from './helpdesk.types';

export interface NewHelpdeskTicket {
  creatorUserId: number;
  description: string;
  attachmentFilename: string | null;
  attachmentOriginalName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
}

@Injectable()
export class HelpdeskRepository {
  constructor(private readonly db: DbService) {}

  async findTickets(userId: number, isAdmin: boolean): Promise<HelpdeskTicketRow[]> {
    const where = isAdmin ? '' : 'WHERE t.creator_user_id = ?';
    const params = isAdmin ? [] : [userId];

    return this.db.execute<HelpdeskTicketRow[]>(
      `SELECT
        t.id,
        t.creator_user_id AS creatorUserId,
        creator.name AS creatorName,
        t.description,
        t.attachment_filename AS attachmentFilename,
        t.attachment_original_name AS attachmentOriginalName,
        t.attachment_mime AS attachmentMime,
        t.attachment_size AS attachmentSize,
        t.status,
        t.service_type AS serviceType,
        t.service_detail AS serviceDetail,
        t.admin_observations AS adminObservations,
        t.resolved_by AS resolvedBy,
        resolver.name AS resolvedByName,
        t.resolved_at AS resolvedAt,
        t.rating,
        t.rated_at AS ratedAt,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM app_helpdesk_tickets t
      LEFT JOIN sys_users creator ON creator.id_users = t.creator_user_id
      LEFT JOIN sys_users resolver ON resolver.id_users = t.resolved_by
      ${where}
      ORDER BY t.created_at DESC, t.id DESC`,
      params,
    );
  }

  async findTicketById(id: number): Promise<HelpdeskTicketRow | null> {
    const rows = await this.db.execute<HelpdeskTicketRow[]>(
      `SELECT
        t.id,
        t.creator_user_id AS creatorUserId,
        creator.name AS creatorName,
        t.description,
        t.attachment_filename AS attachmentFilename,
        t.attachment_original_name AS attachmentOriginalName,
        t.attachment_mime AS attachmentMime,
        t.attachment_size AS attachmentSize,
        t.status,
        t.service_type AS serviceType,
        t.service_detail AS serviceDetail,
        t.admin_observations AS adminObservations,
        t.resolved_by AS resolvedBy,
        resolver.name AS resolvedByName,
        t.resolved_at AS resolvedAt,
        t.rating,
        t.rated_at AS ratedAt,
        t.created_at AS createdAt,
        t.updated_at AS updatedAt
      FROM app_helpdesk_tickets t
      LEFT JOIN sys_users creator ON creator.id_users = t.creator_user_id
      LEFT JOIN sys_users resolver ON resolver.id_users = t.resolved_by
      WHERE t.id = ?
      LIMIT 1`,
      [id],
    );

    return rows[0] ?? null;
  }

  async findNotificationRecipientsByRoles(roleIds: number[]): Promise<HelpdeskNotificationRecipientRow[]> {
    const normalizedRoleIds = roleIds.filter((roleId) => Number.isInteger(roleId) && roleId > 0);
    if (normalizedRoleIds.length === 0) return [];

    const placeholders = normalizedRoleIds.map(() => '?').join(', ');
    const rows = await this.db.execute<HelpdeskNotificationRecipientRow[]>(
      `SELECT id_users AS id, name, email
      FROM sys_users
      WHERE status = 1
        AND rol IN (${placeholders})
        AND email IS NOT NULL
        AND TRIM(email) <> ''`,
      normalizedRoleIds,
    );

    return rows.filter((row) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email).trim()));
  }

  async findTicketEmailContext(id: number): Promise<HelpdeskEmailContextRow | null> {
    const rows = await this.db.execute<HelpdeskEmailContextRow[]>(
      `SELECT
        creator.name AS creatorName,
        creator.email AS creatorEmail,
        resolver.name AS resolvedByName,
        resolver.email AS resolverEmail
      FROM app_helpdesk_tickets t
      LEFT JOIN sys_users creator ON creator.id_users = t.creator_user_id
      LEFT JOIN sys_users resolver ON resolver.id_users = t.resolved_by
      WHERE t.id = ?
      LIMIT 1`,
      [id],
    );

    return rows[0] ?? null;
  }

  async createTicket(ticket: NewHelpdeskTicket): Promise<number> {
    const result = await this.db.execute<ResultSetHeader>(
      `INSERT INTO app_helpdesk_tickets
        (creator_user_id, description, attachment_filename, attachment_original_name, attachment_mime, attachment_size)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ticket.creatorUserId,
        ticket.description,
        ticket.attachmentFilename,
        ticket.attachmentOriginalName,
        ticket.attachmentMime,
        ticket.attachmentSize,
      ],
    );

    return result.insertId;
  }

  async resolveTicket(id: number, payload: { serviceType: string; serviceDetail: string; adminObservations: string; resolvedBy: number }): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE app_helpdesk_tickets
      SET status = 'resolved',
        service_type = ?,
        service_detail = ?,
        admin_observations = ?,
        resolved_by = ?,
        resolved_at = NOW()
      WHERE id = ?`,
      [payload.serviceType, payload.serviceDetail, payload.adminObservations, payload.resolvedBy, id],
    );
  }

  async rateTicket(id: number, rating: number): Promise<void> {
    await this.db.execute<ResultSetHeader>(
      `UPDATE app_helpdesk_tickets
      SET rating = ?, rated_at = NOW()
      WHERE id = ?`,
      [rating, id],
    );
  }

  async findMetrics(userId: number, isAdmin: boolean): Promise<HelpdeskMetricRow[]> {
    const where = isAdmin ? '' : 'WHERE creator_user_id = ?';
    const params = isAdmin ? [] : [userId];

    return this.db.execute<HelpdeskMetricRow[]>(
      `SELECT status, COUNT(*) AS total
      FROM app_helpdesk_tickets
      ${where}
      GROUP BY status`,
      params,
    );
  }

  async findPendingRatings(userId: number): Promise<HelpdeskPendingRatingRow[]> {
    return this.db.execute<HelpdeskPendingRatingRow[]>(
      `SELECT id, description, resolved_at AS resolvedAt
      FROM app_helpdesk_tickets
      WHERE creator_user_id = ?
        AND status = 'resolved'
        AND rating IS NULL
      ORDER BY resolved_at DESC, id DESC`,
      [userId],
    );
  }

  async findServiceTypes(): Promise<HelpdeskOptionRow[]> {
    return this.db.execute<HelpdeskOptionRow[]>(
      `SELECT DISTINCT TRIM(servicio) AS value
      FROM sys_opcion_ticket
      WHERE servicio IS NOT NULL AND TRIM(servicio) <> ''
      ORDER BY value`,
    );
  }

  async findServiceDetails(serviceType: string): Promise<HelpdeskOptionRow[]> {
    return this.db.execute<HelpdeskOptionRow[]>(
      `SELECT DISTINCT TRIM(descripcion) AS value
      FROM sys_opcion_ticket
      WHERE servicio = ?
        AND descripcion IS NOT NULL
        AND TRIM(descripcion) <> ''
      ORDER BY value`,
      [serviceType],
    );
  }
}
