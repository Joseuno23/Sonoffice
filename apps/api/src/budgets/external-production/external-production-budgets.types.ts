import { RowDataPacket } from 'mysql2';

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errorCode?: string;
}

export interface ListQuery {
  page?: unknown;
  pageSize?: unknown;
  search?: unknown;
  estado?: unknown;
}

export interface OptionRow extends RowDataPacket { id: number; label: string; }
export interface CountRow extends RowDataPacket { total: number; }

export interface BudgetRow extends RowDataPacket {
  id: number;
  fecha: Date | string | null;
  idEstado: number | null;
  estado: string | null;
  estadoColor: string | null;
  cliente: string | null;
  proveedor: string | null;
  campana: string | null;
  producto: string | null;
  servicio: string | null;
  ordenCliente: string | null;
  cotizacion: string | null;
  valor: number | null;
  total: number | null;
  incentivoXServicio: number | null;
  numImpresiones: number | null;
  orderNumber: string | null;
}

export interface LegacyButtonPermissionRow extends RowDataPacket { name: string; }

export interface BudgetHeaderRow extends BudgetRow {
  idCliente: number | null;
  idProveedor: number | null;
  clienteDocumento?: string | null;
  clienteDireccion?: string | null;
  clienteTelefono?: string | null;
  clienteCiudad?: string | null;
  proveedorDocumento?: string | null;
  proveedorDireccion?: string | null;
  proveedorTelefono?: string | null;
  proveedorCiudad?: string | null;
  idCampana: number | null;
  idProducto: number | null;
  idServicio: number | null;
  contrato: number | string | null;
  formaPago: string | null;
  observacion: string | null;
  descuento: number | null;
  iva: number | null;
  spa: number | null;
  ivaSpa: number | null;
  fechaAnulacion: Date | string | null;
  consecutivoAnulacion: number | null;
  ordenId: number | null;
  ordenObservacion: string | null;
  usuario?: string | null;
}

export interface PartyPrintRow extends RowDataPacket {
  nombre: string | null;
  documento: string | null;
  direccion: string | null;
  telefono: string | null;
  ciudad: string | null;
}

export interface BillingPrintRow extends RowDataPacket {
  nit: string | null;
  razonSocial: string | null;
  nombreComercial: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  pais: string | null;
  telefono: string | null;
  dv: string | number | null;
}

export interface DetailRow extends RowDataPacket {
  id: number;
  unidad: string | null;
  idServicio: number | null;
  servicio: string | null;
  detalle: string | null;
  valor: number | null;
  iva: number | null;
  incentivo: number | null;
  incentivoArea: string | null;
  incentivoMedio: string | null;
  valorAsignadoOc: number | null;
  ordenCosto: number | null;
  snapshotCosto: number | null;
  snapshotUtilidadSono: number | null;
  snapshotUtilidadProveedor: number | null;
  snapshotDetalle: string | null;
  snapshotNota: string | null;
}

export interface CostOrderDetailRow extends RowDataPacket {
  idOrden: number;
  idDetalle: number;
  detalle: string | null;
  total: number | null;
  totalCobrado: number | null;
  disponible: number | null;
}

export interface IncentiveRow extends RowDataPacket {
  id: number;
  costo: number | null;
  utilidadSono: number | null;
  utilidadProveedor: number | null;
  area: string | null;
  medio: string | null;
  detalle: string | null;
  nota: string | null;
}

export interface OrderRow extends RowDataPacket {
  id: number;
  fecha: Date | string | null;
  fechaImp: Date | string | null;
  proveedor: string | null;
  observacion: string | null;
  numImpresiones: number | null;
}

export interface SupportAttachmentRow extends RowDataPacket {
  ppto: number;
  modulo: number;
  nombre: string | null;
  fecha: Date | string | null;
}

export interface SupportBudgetRow extends RowDataPacket {
  id: number;
  idEstado: number | null;
  estado: string | null;
}

export interface BudgetPayload {
  idCliente?: unknown;
  idProveedor?: unknown;
  idCampana?: unknown;
  idProducto?: unknown;
  idServicio?: unknown;
  contrato?: unknown;
  ordenCliente?: unknown;
  formaPago?: unknown;
  cotizacion?: unknown;
  observacion?: unknown;
  ordenObservacion?: unknown;
  descuento?: unknown;
  iva?: unknown;
  spa?: unknown;
  ivaSpa?: unknown;
}

export interface DetailPayload {
  unidad?: unknown;
  idServicio?: unknown;
  detalle?: unknown;
  valor?: unknown;
  iva?: unknown;
  incentivo?: unknown;
  costoIncentivo?: unknown;
}

export interface CostOrderDetailPayload {
  orderId?: unknown;
  orderDetailId?: unknown;
  assigned?: unknown;
  incentivo?: unknown;
  costoIncentivo?: unknown;
}
