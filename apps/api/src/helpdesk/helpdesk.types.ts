import { RowDataPacket } from 'mysql2';

export type HelpdeskStatus = 'open' | 'resolved';

export interface HelpdeskTicketRow extends RowDataPacket {
  id: number;
  creatorUserId: number;
  creatorName: string | null;
  description: string;
  attachmentFilename: string | null;
  attachmentOriginalName: string | null;
  attachmentMime: string | null;
  attachmentSize: number | null;
  status: HelpdeskStatus;
  serviceType: string | null;
  serviceDetail: string | null;
  adminObservations: string | null;
  resolvedBy: number | null;
  resolvedByName: string | null;
  resolvedAt: Date | string | null;
  rating: number | null;
  ratedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface HelpdeskMetricRow extends RowDataPacket {
  status: HelpdeskStatus;
  total: number;
}

export interface HelpdeskPendingRatingRow extends RowDataPacket {
  id: number;
  description: string;
  resolvedAt: Date | string | null;
}

export interface HelpdeskOptionRow extends RowDataPacket {
  value: string;
}

export interface HelpdeskNotificationRecipientRow extends RowDataPacket {
  id: number;
  name: string | null;
  email: string;
}

export interface HelpdeskEmailContextRow extends RowDataPacket {
  creatorName: string | null;
  creatorEmail: string | null;
  resolvedByName: string | null;
  resolverEmail: string | null;
}

export interface HelpdeskCreatePayload {
  description?: unknown;
}

export interface HelpdeskResolvePayload {
  serviceType?: unknown;
  serviceDetail?: unknown;
  adminObservations?: unknown;
}

export interface HelpdeskRatePayload {
  rating?: unknown;
}

export type HelpdeskErrorCode =
  | 'HELPDESK_DESCRIPTION_REQUIRED'
  | 'HELPDESK_DESCRIPTION_TOO_LONG'
  | 'HELPDESK_PENDING_RATING'
  | 'HELPDESK_ATTACHMENT_INVALID'
  | 'HELPDESK_TICKET_NOT_FOUND'
  | 'HELPDESK_TICKET_ALREADY_RESOLVED'
  | 'HELPDESK_TICKET_NOT_RESOLVED'
  | 'HELPDESK_TICKET_ALREADY_RATED'
  | 'HELPDESK_RATING_INVALID'
  | 'HELPDESK_RESOLVE_FIELDS_REQUIRED'
  | 'HELPDESK_SERVICE_TYPE_NOT_FOUND'
  | 'HELPDESK_SERVICE_DETAIL_NOT_FOUND'
  | 'HELPDESK_SERVER_ERROR';

export type HelpdeskResponse<T> =
  | { success: true; data: T; message: string | null }
  | { success: false; data: null; message: string; errorCode: HelpdeskErrorCode };
