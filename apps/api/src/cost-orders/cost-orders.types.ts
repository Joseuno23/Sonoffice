import { RowDataPacket } from 'mysql2';

// Fila cruda del listado (JOINs contra sys_status, sys_clients x2, cat_campanas, sys_users).
export interface CostOrderRow extends RowDataPacket {
  id: number;
  fecha: Date | string | null;
  estado: string | null;
  color: string | null;
  idEstado: number | null;
  cliente: string | null;
  proveedor: string | null;
  campana: string | null;
  usuario: string | null;
  tipo: string | null; // 'I' | 'E'
  total: number | null;
  valor: number | null;
}

export interface CostOrderCountRow extends RowDataPacket {
  total: number;
}

// Fila de un catálogo simple (id + nombre) para los filtros (ej. proveedores, estados).
export interface CostOrderOptionRow extends RowDataPacket {
  id: number;
  label: string;
}

export interface CostOrderListQuery {
  page?: unknown;
  pageSize?: unknown;
  search?: unknown;
  estado?: unknown;
  proveedor?: unknown;
  fechaIni?: unknown;
  fechaFin?: unknown;
}

export interface CostOrderListItem {
  id: number;
  fecha: string | null;
  estado: string | null;
  estadoColor: string | null;
  idEstado: number | null;
  cliente: string | null;
  proveedor: string | null;
  campana: string | null;
  usuario: string | null;
  tipo: 'INTERNA' | 'EXTERNA' | null;
  total: number;
  // Acciones que el usuario actual PUEDE ejecutar sobre esta orden
  // (permiso del rol ∩ regla de negocio por estado). El frontend solo pinta esto.
  permittedActions: string[];
}

export interface CostOrderListData {
  items: CostOrderListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  // Acciones a nivel de MÓDULO que el rol puede ejecutar (no dependen de una orden puntual),
  // p. ej. "create". El frontend usa esto para mostrar/ocultar el botón "Nueva orden".
  moduleActions: string[];
}

export interface CostOrderCreatePayload {
  idCliente?: unknown;
  idProveedor?: unknown;
  idProducto?: unknown;
  idCampana?: unknown;
  idServicio?: unknown;
  tipo?: unknown; // 'I' | 'E'
  observacion?: unknown;
  porcIva?: unknown;
  porcDescuento?: unknown;
  detalles?: unknown; // array de { detalle, cantidad, valor }
}

export type CostOrderErrorCode =
  | 'COST_ORDERS_SERVER_ERROR'
  | 'COST_ORDERS_FORBIDDEN'
  | 'COST_ORDERS_VALIDATION';

export type CostOrderResponse<T> =
  | { success: true; data: T; message: string | null }
  | { success: false; data: null; message: string; errorCode: CostOrderErrorCode };
