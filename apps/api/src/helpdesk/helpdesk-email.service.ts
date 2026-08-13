import { Injectable } from '@nestjs/common';
import { TransactionalEmailService } from '../email/transactional-email.service';
import { HelpdeskEmailContextRow, HelpdeskNotificationRecipientRow, HelpdeskTicketRow } from './helpdesk.types';

const HELPDESK_URL = '/helpdesk';

@Injectable()
export class HelpdeskEmailService {
  constructor(private readonly transactionalEmailService: TransactionalEmailService) {}

  async sendTicketCreated(ticket: HelpdeskTicketRow, context: HelpdeskEmailContextRow | null, recipients: HelpdeskNotificationRecipientRow[]): Promise<void> {
    const to = recipients.filter((recipient) => this.isValidEmail(recipient.email));
    if (to.length === 0) return;

    await this.transactionalEmailService.sendTemplatedEmail({
      to,
      subject: `Nuevo ticket Helpdesk #${ticket.id} - Sonoffice`,
      title: `Nuevo ticket Helpdesk #${ticket.id}`,
      label: 'Mesa de ayuda',
      icon: '!',
      preheader: `Nuevo ticket #${ticket.id} creado en Mesa de ayuda.`,
      intro: 'Se creó un nuevo ticket en la Mesa de ayuda de Sonoffice.',
      sections: [
        {
          title: 'Detalle del ticket',
          rows: [
            { label: 'Ticket', value: `#${ticket.id}` },
            { label: 'Solicitante', value: this.formatPerson(context?.creatorName, context?.creatorEmail) },
            { label: 'Descripción', value: ticket.description },
            { label: 'Adjunto', value: ticket.attachmentOriginalName ? `${ticket.attachmentOriginalName}${ticket.attachmentSize ? ` (${this.formatBytes(ticket.attachmentSize)})` : ''}` : 'Sin adjunto' },
            { label: 'Fecha de creación', value: this.formatDate(ticket.createdAt) },
            { label: 'Ruta', value: HELPDESK_URL },
          ],
        },
      ],
      cta: { label: 'Ver Mesa de ayuda', url: HELPDESK_URL },
    });
  }

  async sendTicketResolved(ticket: HelpdeskTicketRow, context: HelpdeskEmailContextRow | null): Promise<void> {
    if (!context?.creatorEmail || !this.isValidEmail(context.creatorEmail)) return;

    await this.transactionalEmailService.sendTemplatedEmail({
      to: [{ email: context.creatorEmail, name: context.creatorName }],
      subject: `Tu ticket Helpdesk #${ticket.id} fue resuelto - Sonoffice`,
      title: `Ticket Helpdesk #${ticket.id} resuelto`,
      label: 'Ticket resuelto',
      icon: '✓',
      preheader: `Tu ticket #${ticket.id} fue resuelto. Recuerda calificar la atención.`,
      intro: [
        'Tu solicitud fue marcada como resuelta en la Mesa de ayuda de Sonoffice.',
        'Antes de crear un nuevo ticket, recuerda calificar esta atención de 1 a 5 estrellas.',
      ],
      sections: [
        {
          title: 'Resolución',
          rows: [
            { label: 'Ticket', value: `#${ticket.id}` },
            { label: 'Tipo de servicio', value: ticket.serviceType },
            { label: 'Detalle de servicio', value: ticket.serviceDetail },
            { label: 'Observaciones del administrador', value: ticket.adminObservations },
            { label: 'Resuelto por', value: this.formatPerson(context.resolvedByName, context.resolverEmail) },
            { label: 'Fecha de resolución', value: this.formatDate(ticket.resolvedAt) },
            { label: 'Ruta para calificar', value: HELPDESK_URL },
          ],
        },
      ],
      cta: { label: 'Calificar atención', url: HELPDESK_URL },
    });
  }

  private formatPerson(name?: string | null, email?: string | null): string {
    const cleanName = name?.trim();
    const cleanEmail = email?.trim();
    if (cleanName && cleanEmail) return `${cleanName} <${cleanEmail}>`;
    return cleanName || cleanEmail || 'No disponible';
  }

  private formatDate(value: Date | string | null | undefined): string {
    if (!value) return 'No disponible';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-CO');
  }

  private formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private isValidEmail(email: string | null | undefined): email is string {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }
}
