import { RowDataPacket } from 'mysql2';

export interface ExpenseOrderListQuery { page?: unknown; pageSize?: unknown; search?: unknown; proveedor?: unknown; fechaIni?: unknown; fechaFin?: unknown; }

export interface ExpenseOrderRow extends RowDataPacket {
  id: number; fecha: Date | string | null; estado: string | null; estadoColor: string | null; idEstado: number | null;
  proveedor: string | null; proveedorDocumento: string | null; usuario: string | null; servicio: string | null;
  valor: number | null; total: number | null; numImpresiones: number | null; aprobada: number | null; recurrente: number | null;
}

export interface CountRow extends RowDataPacket { total: number; }
export interface OptionRow extends RowDataPacket { id: number; label: string; }
export interface DefaultsRow extends RowDataPacket { iva: number | null; }
export interface SequenceRow extends RowDataPacket { consecutivo: number | null; }

export interface ExpenseOrderDetailRow extends RowDataPacket { idDetalle: number; detalle: string | null; cantidad: number | null; valor: number | null; }

export interface ExpenseOrderHeaderRow extends ExpenseOrderRow {
  idProveedor: number | null; idServicio: number | null; observacion: string | null; descuento: number | null; iva: number | null;
  fechaAnulacion: Date | string | null; consecutivoAnulacion: number | null; inicioRecurrencia: Date | string | null; finRecurrencia: Date | string | null;
}

export interface ExpenseOrderListItem {
  id: number; fecha: string | null; estado: string | null; estadoColor: string | null; idEstado: number | null;
  proveedor: string | null; usuario: string | null; servicio: string | null; total: number; aprobada: boolean; recurrente: boolean;
  permittedActions: string[];
}

export interface ExpenseOrderListData { items: ExpenseOrderListItem[]; page: number; pageSize: number; total: number; totalPages: number; moduleActions: string[]; }

export interface ExpenseOrderPayload { idProveedor?: unknown; idServicio?: unknown; observacion?: unknown; descuento?: unknown; iva?: unknown; detalles?: unknown; }
export interface ExpenseOrderDetailPayload { detalle?: unknown; valor?: unknown; cantidad?: unknown; }
export interface ExpenseOrderRecurrencePayload { inicioRecurrencia?: unknown; finRecurrencia?: unknown; }

export interface ExpenseOrderApproveBulkFile { originalname?: string; buffer?: Buffer; }
export interface ExpenseOrderApproveBulkResult { parsed: number; approved: number; skipped: number; files: number; }

export interface ExpenseOrderDetailData {
  id: number; fecha: string | null; estado: string | null; estadoColor: string | null; idEstado: number | null; editable: boolean;
  idProveedor: number | null; proveedor: string | null; idServicio: number | null; servicio: string | null; observacion: string | null;
  descuento: number; iva: number; valor: number; total: number; aprobada: boolean; recurrente: boolean;
  inicioRecurrencia: string | null; finRecurrencia: string | null; fechaAnulacion: string | null; consecutivoAnulacion: number | null;
  detalles: { idDetalle: number; detalle: string; cantidad: number; valor: number }[]; permittedActions: string[];
}

export interface ExpenseOrderPrintData {
  order: { id: number; fecha: string | null; estado: string | null; copyLabel: 'ORIGINAL' | 'DUPLICADO'; observacion: string | null; aprobada: boolean; numImpresiones: number; };
  provider: { name: string | null; nit: string | null; };
  service: string | null; user: string | null;
  details: { idDetalle: number; detalle: string; cantidad: number; valor: number }[];
  totals: { valor: number; descuento: number; subtotal: number; iva: number; total: number; porcDescuento: number; porcIva: number };
}

export type ExpenseOrderResponse<T> =
  | { success: true; data: T; message: string | null }
  | { success: false; data: null; message: string; errorCode: 'EXPENSE_ORDERS_SERVER_ERROR' | 'EXPENSE_ORDERS_FORBIDDEN' | 'EXPENSE_ORDERS_VALIDATION' };
