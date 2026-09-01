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
  hasFinalObservation: number;
  hasBudgetLinks: number;
}

export interface CostOrderCountRow extends RowDataPacket {
  total: number;
}

// Fila de un catálogo simple (id + nombre) para los filtros (ej. proveedores, estados).
export interface CostOrderOptionRow extends RowDataPacket {
  id: number;
  label: string;
}

export interface CostOrderBudgetTypeRow extends RowDataPacket {
  id: number;
  label: string;
}

export interface CostOrderDefaultsRow extends RowDataPacket {
  iva: number | null;
}

export interface CostOrderDefaultsData {
  porcIva: number;
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
  hasFinalObservation: boolean;
  hasBudgetLinks: boolean;
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

export interface CostOrderDuplicateCandidate {
  id: number;
  fecha: string | null;
  cliente: string | null;
  proveedor: string | null;
  campana: string | null;
  total: number;
}

export interface CostOrderDuplicateCandidateRow extends RowDataPacket, CostOrderDuplicateCandidate {}

export interface CostOrderDuplicatePayload {
  orderIds?: unknown;
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
  budgetDetails?: unknown; // array de { tipo, ppto, idDetallePpto, cantidad, valorAsignado }
}

export type CostOrderUpdatePayload = CostOrderCreatePayload;

export interface CostOrderFinalObservationPayload {
  observacion?: unknown;
}

// Fila cruda de la cabecera al cargar para edición.
export interface CostOrderHeaderRow extends RowDataPacket {
  id: number;
  idEstado: number | null;
  estado: string | null;
  color: string | null;
  idCliente: number | null;
  cliente: string | null;
  idProveedor: number | null;
  proveedor: string | null;
  idCampana: number | null;
  campana: string | null;
  idProducto: number | null;
  producto: string | null;
  idServicio: number | null;
  servicio: string | null;
  tipo: string | null;
  observacion: string | null;
  porcIva: number | null;
  porcDescuento: number | null;
  valor: number | null;
  total: number | null;
  cobrado: number | null;
  faltante: number | null;
  fecha: Date | string | null;
  tipoPpto: number | string | null;
}

export interface CostOrderDuplicateHeaderRow extends RowDataPacket {
  id: number;
  idCliente: number | null;
  idProveedor: number | null;
  idCampana: number | null;
  idProducto: number | null;
  idServicio: number | null;
  tipo: string | null;
  observacion: string | null;
  porcIva: number | null;
  porcDescuento: number | null;
  valor: number | null;
  total: number | null;
}

export interface CostOrderReplacementHeaderRow extends RowDataPacket {
  id: number;
  idEstado: number | null;
  idCliente: number | null;
  idProveedor: number | null;
  idCampana: number | null;
  idProducto: number | null;
  idServicio: number | null;
  tipo: string | null;
  observacion: string | null;
  porcIva: number | null;
  porcDescuento: number | null;
  valor: number | null;
  total: number | null;
  cobrado: number | null;
  faltante: number | null;
}

export interface CostOrderFinalizeRow extends RowDataPacket {
  id: number;
  idEstado: number | null;
  valor: number | null;
  faltante: number | null;
}

// Fila cruda de una línea de detalle (con flag de si está vinculada a presupuesto).
export interface CostOrderDetailRow extends RowDataPacket {
  idDetalle: number;
  detalle: string;
  cantidad: number;
  valor: number;
  total: number;
  hasBudget: number; // 1 si tiene sys_oc_ppto, 0 si no
  budgetTipo: number | null;
  budgetPpto: number | null;
  budgetIdDetallePpto: number | null;
  budgetValorAsignado: number | null;
}

export interface CostOrderReplacementDetailRow extends RowDataPacket {
  idDetalle: number;
  detalle: string;
  cantidad: number;
  valor: number;
  total: number;
  totalCobrado: number | null;
}

export interface CostOrderBudgetLinkRow extends RowDataPacket {
  idPpto: number | null;
  idDetallePpto: number | null;
  idDetalleOrden: number | null;
  modulo: number | null;
  cobradoItem: number | null;
}

export interface CostOrderPrintHeaderRow extends RowDataPacket {
  id: number;
  fecha: Date | string | null;
  idEstado: number | null;
  estado: string | null;
  tipo: string | null;
  observacion: string | null;
  porcIva: number | null;
  porcDescuento: number | null;
  valor: number | null;
  total: number | null;
  numImpresiones: number | null;
  cliente: string | null;
  clienteDocumento: string | null;
  clienteDireccion: string | null;
  clienteTelefono: string | null;
  clienteCiudad: string | null;
  proveedor: string | null;
  proveedorDocumento: string | null;
  proveedorDireccion: string | null;
  proveedorTelefono: string | null;
  proveedorCiudad: string | null;
  campana: string | null;
  producto: string | null;
  servicio: string | null;
  creador: string | null;
  creadorEmail: string | null;
}

export interface CostOrderPrintBudgetRow extends RowDataPacket {
  ppto: number;
  tipo: number | null;
}

export interface CostOrderPrintBillingRow extends RowDataPacket {
  nit: string | null;
  razonSocial: string | null;
  nombreComercial: string | null;
  direccion: string | null;
  ciudad: string | null;
  departamento: string | null;
  pais: string | null;
  telefono: string | null;
  dv: string | null;
}

export interface CostOrderBudgetLineRow extends RowDataPacket {
  id: number;
  idDetalle: number;
  detalle: string;
  total: number;
  estado: number;
  valorAsignadoOc: number;
  ordenCosto: number;
  idCliente: number;
  idProveedor: number;
  disponible: number;
}

export interface CostOrderCompensateDetailRow extends RowDataPacket {
  idDetalle: number;
  detalle: string;
  cantidad: number;
  valor: number;
  total: number;
  totalCobrado: number | null;
  faltante: number;
}

export interface CostOrderCompensateAssociationRow extends RowDataPacket {
  associationId: number | null;
  idDetalleOrden: number;
  idDetallePpto: number;
  idPpto: number;
  modulo: number;
  cobradoItem: number;
  orderDetail: string | null;
  budgetDetail: string | null;
}

export interface CostOrderCompensateQuery {
  orderId?: unknown;
  tipo?: unknown;
  ppto?: unknown;
}

export interface CostOrderCompensateAssociationInput {
  idDetalleOrden?: unknown;
  idDetallePpto?: unknown;
  valor?: unknown;
}

export interface CostOrderCompensatePayload {
  orderId?: unknown;
  tipo?: unknown;
  ppto?: unknown;
  associations?: unknown;
}

export interface CostOrderCompensateReversePayload {
  orderId?: unknown;
  associationId?: unknown;
}

export interface CostOrderCompensateOrderDetail {
  idDetalle: number;
  detalle: string;
  total: number;
  totalCobrado: number;
  faltante: number;
}

export interface CostOrderCompensateBudgetLine {
  idPpto: number;
  idDetallePpto: number;
  detalle: string;
  total: number;
  valorAsignadoOc: number;
  ordenCosto: number;
  disponible: number;
}

export interface CostOrderCompensateAssociation {
  associationId: number | null;
  idDetalleOrden: number;
  idDetallePpto: number;
  idPpto: number;
  modulo: number;
  tipoLabel: string | null;
  cobradoItem: number;
  orderDetail: string | null;
  budgetDetail: string | null;
}

export interface CostOrderCompensateData {
  order: {
    id: number;
    idEstado: number | null;
    estado: string | null;
    cliente: string | null;
    proveedor: string | null;
    total: number;
    cobrado: number;
    faltante: number;
  } | null;
  budget: {
    tipo: number;
    ppto: number;
    estado: number | null;
  } | null;
  orderDetails: CostOrderCompensateOrderDetail[];
  budgetLines: CostOrderCompensateBudgetLine[];
  associations: CostOrderCompensateAssociation[];
  budgetTypes: { id: number; label: string }[];
}

export interface CostOrderCompensateSuggestion {
  idDetalleOrden: number;
  idDetallePpto: number;
  orderDetail: string;
  budgetDetail: string;
  suggestedValue: number;
  confidence: 'Alta' | 'Media' | 'Baja';
  score: number;
  reason: string;
  conflict: boolean;
  includeInBulk: boolean;
}

export interface CostOrderBudgetAttachPayload {
  tipo?: unknown;
  ppto?: unknown;
  idDetallePpto?: unknown;
  detalle?: unknown;
  cantidad?: unknown;
  valorAsignado?: unknown;
}

export interface CostOrderBudgetSearchQuery {
  idCliente?: unknown;
  idProveedor?: unknown;
  tipo?: unknown;
  ppto?: unknown;
}

export interface CostOrderDetailItem {
  idDetalle: number;
  detalle: string;
  cantidad: number;
  valor: number;
  total: number;
  hasBudget: boolean;
  budgetTipo: number | null;
  budgetPpto: number | null;
  budgetIdDetallePpto: number | null;
  budgetValorAsignado: number | null;
}

export interface CostOrderDetailData {
  id: number;
  idEstado: number | null;
  estado: string | null;
  editable: boolean; // solo estado 1
  idCliente: number | null;
  cliente: string | null;
  idProveedor: number | null;
  proveedor: string | null;
  idCampana: number | null;
  campana: string | null;
  idProducto: number | null;
  producto: string | null;
  idServicio: number | null;
  servicio: string | null;
  tipo: 'INTERNA' | 'EXTERNA' | null;
  observacion: string | null;
  porcIva: number;
  porcDescuento: number;
  valor: number;
  total: number;
  detalles: CostOrderDetailItem[];
  permittedActions: string[];
}

export interface CostOrderPrintData {
  company: {
    name: string;
    commercialName: string | null;
    nit: string | null;
    address: string | null;
    city: string | null;
    department: string | null;
    country: string | null;
    phone: string | null;
  };
  order: {
    id: number;
    fecha: string | null;
    estado: string | null;
    tipo: 'INTERNA' | 'EXTERNA' | null;
    copyLabel: 'ORIGINAL' | 'DUPLICADO';
    numImpresiones: number;
    observacion: string | null;
  };
  client: { name: string | null; nit: string | null; address: string | null; phone: string | null; city: string | null };
  provider: { name: string | null; nit: string | null; address: string | null; phone: string | null; city: string | null };
  campaign: string | null;
  product: string | null;
  service: string | null;
  budgets: { ppto: number; tipo: number | null }[];
  details: { idDetalle: number; detalle: string; cantidad: number; valor: number; total: number }[];
  totals: { valor: number; descuento: number; subtotal: number; iva: number; total: number; porcDescuento: number; porcIva: number };
  creator: { name: string | null; email: string | null };
}

export interface CostOrderPrintMutationData {
  id: number;
  idEstado: number | null;
  numImpresiones: number;
  copyLabel: 'ORIGINAL' | 'DUPLICADO';
}

export type CostOrderErrorCode =
  | 'COST_ORDERS_SERVER_ERROR'
  | 'COST_ORDERS_FORBIDDEN'
  | 'COST_ORDERS_VALIDATION';

export type CostOrderResponse<T> =
  | { success: true; data: T; message: string | null }
  | { success: false; data: null; message: string; errorCode: CostOrderErrorCode };
