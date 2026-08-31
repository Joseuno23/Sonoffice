import { RowDataPacket } from 'mysql2';

export interface ReportOptionRow extends RowDataPacket {
  id: number;
  label: string;
}

export interface CostOrdersReportQuery {
  fechaIni?: unknown;
  fechaFin?: unknown;
  cliente?: unknown;
  proveedor?: unknown;
}

export type CostOrdersCompensationReportStatus = 'cobrados' | 'pendientes';

export interface CostOrdersCompensationReportQuery {
  fechaIni?: unknown;
  fechaFin?: unknown;
  status?: unknown;
}

export interface CostOrdersReportFilters {
  fechaIni: string;
  fechaFin: string;
  cliente: number | null;
  proveedor: number | null;
}

export interface CostOrdersCompensationReportFilters {
  fechaIni: string;
  fechaFin: string;
  status: CostOrdersCompensationReportStatus;
}

export interface CostOrdersReportRow extends RowDataPacket {
  fecha: Date | string | null;
  orden: number | string | null;
  usuario: string | null;
  pptoIngresado: number | string | null;
  pptoAsociado: number | string | null;
  observacionGuia: string | null;
  cliente: string | null;
  clienteNit: string | null;
  clienteSap: string | null;
  proveedor: string | null;
  proveedorNit: string | null;
  proveedorSap: string | null;
  detalle: string | null;
  campana: string | null;
  producto: string | null;
  valor: number | string | null;
  descuento: number | string | null;
  iva: number | string | null;
  total: number | string | null;
  cobrado: number | string | null;
  faltante: number | string | null;
  servicio: string | null;
  cebe: string | null;
  tipo: string | null;
  estado: string | null;
}

export interface CostOrdersCompensationReportRow extends RowDataPacket {
  orden: number | string | null;
  cliente: string | null;
  proveedor: string | null;
  estado: string | null;
  usuario: string | null;
  observacion: string | null;
  valorBruto: number | string | null;
  totalOrden: number | string | null;
  totalCobrado: number | string | null;
  totalFaltante: number | string | null;
  servicio: string | null;
  tipo: string | null;
  detalle: string | null;
  valorDetalle: number | string | null;
  cobradoDetalle: number | string | null;
  faltanteDetalle: number | string | null;
}

export interface CostOrdersReportOptions {
  clientes: { id: number; label: string }[];
  proveedores: { id: number; label: string }[];
}
