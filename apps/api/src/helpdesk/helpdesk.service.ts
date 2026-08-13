import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, resolve } from 'path';
import { RequestUser } from '../auth/auth-user.decorator';
import { UPLOADS_DIR } from '../uploads-path';
import { HelpdeskEmailService } from './helpdesk-email.service';
import { HelpdeskRepository } from './helpdesk.repository';
import { HelpdeskCreatePayload, HelpdeskRatePayload, HelpdeskResolvePayload, HelpdeskResponse, HelpdeskTicketRow } from './helpdesk.types';

const ROOT_ROLE_ID = 1;
const HELPDESK_NOTIFICATION_ROLE_IDS = [1, 15];
const MAX_DESCRIPTION_LENGTH = 3000;
const MAX_OBSERVATIONS_LENGTH = 3000;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const HELPDESK_UPLOADS_DIR = resolve(UPLOADS_DIR, 'helpdesk');
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Injectable()
export class HelpdeskService {
  constructor(
    private readonly helpdeskRepository: HelpdeskRepository,
    private readonly helpdeskEmailService: HelpdeskEmailService,
  ) {}

  async listTickets(user: RequestUser): Promise<HelpdeskResponse<any>> {
    try {
      const isAdmin = user.roleId === ROOT_ROLE_ID;
      const [tickets, metrics, pendingRatings] = await Promise.all([
        this.helpdeskRepository.findTickets(user.userId, isAdmin),
        this.helpdeskRepository.findMetrics(user.userId, isAdmin),
        this.helpdeskRepository.findPendingRatings(user.userId),
      ]);

      return {
        success: true,
        data: {
          tickets: tickets.map((ticket) => this.normalizeTicket(ticket)),
          metrics: this.normalizeMetrics(metrics),
          pendingRatings,
          canCreate: pendingRatings.length === 0,
          isAdmin,
        },
        message: null,
      };
    } catch (error) {
      return this.handleHelpdeskError(error);
    }
  }

  async getMetrics(user: RequestUser): Promise<HelpdeskResponse<any>> {
    try {
      const rows = await this.helpdeskRepository.findMetrics(user.userId, user.roleId === ROOT_ROLE_ID);
      return { success: true, data: this.normalizeMetrics(rows), message: null };
    } catch (error) {
      return this.handleHelpdeskError(error);
    }
  }

  async createTicket(user: RequestUser, payload: HelpdeskCreatePayload, attachment?: any): Promise<HelpdeskResponse<any>> {
    const description = this.toTrimmedString(payload?.description);

    if (!description) {
      return { success: false, data: null, message: 'La descripción del servicio requerido es obligatoria', errorCode: 'HELPDESK_DESCRIPTION_REQUIRED' };
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, data: null, message: 'La descripción no puede superar 3000 caracteres', errorCode: 'HELPDESK_DESCRIPTION_TOO_LONG' };
    }

    const attachmentError = this.validateAttachment(attachment);
    if (attachmentError) return attachmentError;

    try {
      const pendingRatings = await this.helpdeskRepository.findPendingRatings(user.userId);
      if (pendingRatings.length > 0) {
        return { success: false, data: null, message: 'Tienes tickets resueltos pendientes de calificar antes de crear uno nuevo', errorCode: 'HELPDESK_PENDING_RATING' };
      }

      const storedAttachment = attachment ? await this.storeAttachment(attachment) : null;
      const id = await this.helpdeskRepository.createTicket({
        creatorUserId: user.userId,
        description,
        attachmentFilename: storedAttachment?.filename ?? null,
        attachmentOriginalName: attachment?.originalname ?? null,
        attachmentMime: attachment?.mimetype ?? null,
        attachmentSize: attachment?.size ?? null,
      });
      const ticket = await this.helpdeskRepository.findTicketById(id);
      await this.notifyTicketCreatedSafely(ticket);

      return { success: true, data: this.normalizeTicket(ticket), message: 'Ticket creado correctamente' };
    } catch (error) {
      return this.handleHelpdeskError(error);
    }
  }

  async resolveTicket(user: RequestUser, rawId: unknown, payload: HelpdeskResolvePayload): Promise<HelpdeskResponse<any>> {
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.ticketNotFoundResponse();

    const serviceType = this.toTrimmedString(payload?.serviceType);
    const serviceDetail = this.toTrimmedString(payload?.serviceDetail);
    const adminObservations = this.toTrimmedString(payload?.adminObservations);

    if (!serviceType || !serviceDetail || !adminObservations) {
      return { success: false, data: null, message: 'Tipo, detalle de servicio y observaciones son obligatorios', errorCode: 'HELPDESK_RESOLVE_FIELDS_REQUIRED' };
    }

    if (adminObservations.length > MAX_OBSERVATIONS_LENGTH) {
      return { success: false, data: null, message: 'Las observaciones no pueden superar 3000 caracteres', errorCode: 'HELPDESK_RESOLVE_FIELDS_REQUIRED' };
    }

    try {
      const ticket = await this.helpdeskRepository.findTicketById(id);
      if (!ticket) return this.ticketNotFoundResponse();
      if (ticket.status === 'resolved') {
        return { success: false, data: null, message: 'Este ticket ya fue resuelto', errorCode: 'HELPDESK_TICKET_ALREADY_RESOLVED' };
      }

      const types = await this.helpdeskRepository.findServiceTypes();
      if (!types.some((type) => type.value === serviceType)) {
        return { success: false, data: null, message: 'Tipo de servicio no encontrado', errorCode: 'HELPDESK_SERVICE_TYPE_NOT_FOUND' };
      }

      const details = await this.helpdeskRepository.findServiceDetails(serviceType);
      if (!details.some((detail) => detail.value === serviceDetail)) {
        return { success: false, data: null, message: 'Detalle de servicio no encontrado para el tipo seleccionado', errorCode: 'HELPDESK_SERVICE_DETAIL_NOT_FOUND' };
      }

      await this.helpdeskRepository.resolveTicket(id, { serviceType, serviceDetail, adminObservations, resolvedBy: user.userId });
      const updated = await this.helpdeskRepository.findTicketById(id);
      await this.notifyTicketResolvedSafely(updated);

      return { success: true, data: this.normalizeTicket(updated), message: 'Ticket resuelto correctamente' };
    } catch (error) {
      return this.handleHelpdeskError(error);
    }
  }

  async rateTicket(user: RequestUser, rawId: unknown, payload: HelpdeskRatePayload): Promise<HelpdeskResponse<any>> {
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.ticketNotFoundResponse();

    const rating = this.toPositiveInteger(payload?.rating);
    if (!rating || rating < 1 || rating > 5) {
      return { success: false, data: null, message: 'La calificación debe estar entre 1 y 5 estrellas', errorCode: 'HELPDESK_RATING_INVALID' };
    }

    try {
      const ticket = await this.helpdeskRepository.findTicketById(id);
      if (!ticket || ticket.creatorUserId !== user.userId) return this.ticketNotFoundResponse();
      if (ticket.status !== 'resolved') return { success: false, data: null, message: 'Solo puedes calificar tickets resueltos', errorCode: 'HELPDESK_TICKET_NOT_RESOLVED' };
      if (ticket.rating) return { success: false, data: null, message: 'Este ticket ya fue calificado', errorCode: 'HELPDESK_TICKET_ALREADY_RATED' };

      await this.helpdeskRepository.rateTicket(id, rating);
      const updated = await this.helpdeskRepository.findTicketById(id);
      return { success: true, data: this.normalizeTicket(updated), message: 'Gracias por calificar el ticket' };
    } catch (error) {
      return this.handleHelpdeskError(error);
    }
  }

  async getServiceTypes(): Promise<HelpdeskResponse<string[]>> {
    try {
      const rows = await this.helpdeskRepository.findServiceTypes();
      return { success: true, data: rows.map((row) => row.value), message: null };
    } catch (error) {
      return this.handleHelpdeskError(error);
    }
  }

  async getServiceDetails(serviceType: unknown): Promise<HelpdeskResponse<string[]>> {
    const normalizedServiceType = this.toTrimmedString(serviceType);
    if (!normalizedServiceType) return { success: true, data: [], message: null };

    try {
      const rows = await this.helpdeskRepository.findServiceDetails(normalizedServiceType);
      return { success: true, data: rows.map((row) => row.value), message: null };
    } catch (error) {
      return this.handleHelpdeskError(error);
    }
  }

  private normalizeTicket(ticket: HelpdeskTicketRow | null) {
    if (!ticket) return null;
    const attachmentUrl = ticket.attachmentFilename ? `/uploads/helpdesk/${encodeURIComponent(ticket.attachmentFilename)}` : null;

    return {
      ...ticket,
      id: Number(ticket.id),
      creatorUserId: Number(ticket.creatorUserId),
      attachmentSize: ticket.attachmentSize === null ? null : Number(ticket.attachmentSize),
      resolvedBy: ticket.resolvedBy === null ? null : Number(ticket.resolvedBy),
      rating: ticket.rating === null ? null : Number(ticket.rating),
      attachmentUrl,
      attachmentIsImage: !!ticket.attachmentMime?.startsWith('image/'),
    };
  }

  private normalizeMetrics(rows: Array<{ status: string; total: number }>) {
    const metrics = { open: 0, resolved: 0, total: 0 };
    rows.forEach((row) => {
      if (row.status === 'open' || row.status === 'resolved') metrics[row.status] = Number(row.total ?? 0);
    });
    metrics.total = metrics.open + metrics.resolved;
    return metrics;
  }

  private validateAttachment(attachment?: any): HelpdeskResponse<null> | null {
    if (!attachment) return null;
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(attachment.mimetype) || !attachment.buffer || attachment.size > MAX_ATTACHMENT_SIZE) {
      return { success: false, data: null, message: 'Adjunto inválido. Se permiten imágenes, PDF, Word o Excel hasta 5 MB', errorCode: 'HELPDESK_ATTACHMENT_INVALID' };
    }
    return null;
  }

  private async storeAttachment(attachment: any): Promise<{ filename: string }> {
    await mkdir(HELPDESK_UPLOADS_DIR, { recursive: true });
    const extension = extname(String(attachment.originalname || '')).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(resolve(HELPDESK_UPLOADS_DIR, filename), attachment.buffer);
    return { filename };
  }

  private toPositiveInteger(value: unknown): number | null {
    if (Array.isArray(value)) return null;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '' || normalized === null || normalized === undefined) return null;
    const numberValue = Number(normalized);
    return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
  }

  private toTrimmedString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private ticketNotFoundResponse(): HelpdeskResponse<null> {
    return { success: false, data: null, message: 'Ticket no encontrado', errorCode: 'HELPDESK_TICKET_NOT_FOUND' };
  }

  private async notifyTicketCreatedSafely(ticket: HelpdeskTicketRow | null): Promise<void> {
    if (!ticket) return;

    try {
      const [recipients, context] = await Promise.all([
        this.helpdeskRepository.findNotificationRecipientsByRoles(HELPDESK_NOTIFICATION_ROLE_IDS),
        this.helpdeskRepository.findTicketEmailContext(ticket.id),
      ]);
      await this.helpdeskEmailService.sendTicketCreated(ticket, context, recipients);
    } catch (error) {
      console.error('Helpdesk ticket created email error', this.toSafeEmailError(error));
    }
  }

  private async notifyTicketResolvedSafely(ticket: HelpdeskTicketRow | null): Promise<void> {
    if (!ticket) return;

    try {
      const context = await this.helpdeskRepository.findTicketEmailContext(ticket.id);
      await this.helpdeskEmailService.sendTicketResolved(ticket, context);
    } catch (error) {
      console.error('Helpdesk ticket resolved email error', this.toSafeEmailError(error));
    }
  }

  private toSafeEmailError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message === 'BREVO_CONFIG_MISSING' ? error.message : 'EMAIL_SEND_FAILED',
      };
    }

    if (typeof error === 'object' && error !== null) {
      const emailError = error as Record<string, unknown>;
      return {
        statusCode: emailError.statusCode,
        code: emailError.code,
      };
    }

    return {};
  }

  private handleHelpdeskError(error: unknown): HelpdeskResponse<null> {
    if (typeof error === 'object' && error !== null && ('code' in error || 'errno' in error || 'sqlState' in error)) {
      const databaseError = error as Record<string, unknown>;
      console.error('Helpdesk database error', { code: databaseError.code, errno: databaseError.errno, sqlState: databaseError.sqlState });
      return { success: false, data: null, message: 'No se pudo procesar Mesa de ayuda en este momento', errorCode: 'HELPDESK_SERVER_ERROR' };
    }
    throw error;
  }
}
