import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PermissionsService } from '../permissions/permissions.service';
import { EXPENSE_ORDER_STATUS, ExpenseOrdersRepository, NormalizedExpenseOrderPayload } from './expense-orders.repository';
import { ExpenseOrderApproveBulkFile, ExpenseOrderApproveBulkResult, ExpenseOrderDetailData, ExpenseOrderListData, ExpenseOrderListItem, ExpenseOrderListQuery, ExpenseOrderPayload, ExpenseOrderPrintData, ExpenseOrderRecurrencePayload, ExpenseOrderResponse, ExpenseOrderRow } from './expense-orders.types';

export const EXPENSE_ORDERS_MODULE = 'expense-orders';
const EXPENSE_ORDERS_MENU_CODES = ['media.expense-orders.list', 'media.expense-orders'];
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MODULE_LEVEL_ACTIONS = new Set(['create']);
const PRINT_PREVIEW_ACTION = 'print-preview';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_IVA = 19;

@Injectable()
export class ExpenseOrdersService {
  constructor(private readonly repository: ExpenseOrdersRepository, private readonly permissionsService: PermissionsService) {}

  async listOrders(roleId: number, query: ExpenseOrderListQuery): Promise<ExpenseOrderResponse<ExpenseOrderListData>> {
    const forbidden = await this.requireModuleAccess(roleId);
    if (forbidden) return forbidden;
    const page = this.toPositiveInteger(query.page) ?? 1;
    const pageSize = Math.min(this.toPositiveInteger(query.pageSize) ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const filters = { search: this.toString(query.search), proveedor: this.toPositiveInteger(query.proveedor), fechaIni: this.toDateString(query.fechaIni), fechaFin: this.toDateString(query.fechaFin) };
    if (!filters.fechaIni || !filters.fechaFin) { filters.fechaIni = null; filters.fechaFin = null; }
    try {
      const [rows, total, roleActions] = await Promise.all([
        this.repository.findOrders(filters, pageSize, (page - 1) * pageSize),
        this.repository.countOrders(filters),
        this.permissionsService.getRoleModuleActions(roleId, EXPENSE_ORDERS_MODULE),
      ]);
      return { success: true, data: { items: rows.map((row) => this.normalizeListItem(row, roleActions)), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), moduleActions: [...roleActions].filter((a) => MODULE_LEVEL_ACTIONS.has(a)) }, message: null };
    } catch (error) { return this.handleError(error); }
  }

  async getStatuses() { return this.optionResponse(() => this.repository.findStatuses()); }
  async getProviders(search: unknown) { return this.optionResponse(() => this.repository.findProviders(this.toString(search), 30)); }

  async getDefaults(): Promise<ExpenseOrderResponse<{ iva: number }>> {
    try {
      const row = await this.repository.findDefaults();
      const iva = this.toNumber(row?.iva, FALLBACK_IVA);
      return { success: true, data: { iva: Number.isFinite(iva) && iva >= 0 ? iva : FALLBACK_IVA }, message: null };
    } catch (error) { return this.handleError(error); }
  }

  async createOrder(userId: number, roleId: number, payload: ExpenseOrderPayload): Promise<ExpenseOrderResponse<{ id: number }>> {
    const forbidden = await this.requireAction(roleId, 'create', 'No tienes permiso para crear órdenes de gastos');
    if (forbidden) return forbidden;
    const legacyUserId = await this.repository.findLegacyUserId(userId);
    if (!legacyUserId) return this.fail('No se encontró el usuario legacy asociado a la sesión');
    const normalized = this.normalizePayload(payload);
    if ('message' in normalized) return this.fail(normalized.message);
    try {
      const id = await this.repository.createOrder(legacyUserId, normalized);
      return { success: true, data: { id }, message: 'Orden de gastos creada correctamente' };
    } catch (error) { return this.handleError(error); }
  }

  async getOrder(rawId: unknown, roleId: number): Promise<ExpenseOrderResponse<ExpenseOrderDetailData>> {
    const forbidden = await this.requireModuleAccess(roleId);
    if (forbidden) return forbidden;
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.fail('Orden de gastos no encontrada');
    try {
      const [header, details, roleActions] = await Promise.all([this.repository.findOrderById(id), this.repository.findDetails(id), this.permissionsService.getRoleModuleActions(roleId, EXPENSE_ORDERS_MODULE)]);
      if (!header) return this.fail('Orden de gastos no encontrada');
      return { success: true, data: this.normalizeDetail(header, details, roleActions), message: null };
    } catch (error) { return this.handleError(error); }
  }

  async updateOrder(userId: number, roleId: number, rawId: unknown, payload: ExpenseOrderPayload): Promise<ExpenseOrderResponse<{ id: number }>> {
    const forbidden = await this.requireAction(roleId, 'edit', 'No tienes permiso para editar órdenes de gastos');
    if (forbidden) return forbidden;
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.fail('Orden de gastos no encontrada');
    const legacyUserId = await this.repository.findLegacyUserId(userId);
    if (!legacyUserId) return this.fail('No se encontró el usuario legacy asociado a la sesión');
    const normalized = this.normalizePayload(payload);
    if ('message' in normalized) return this.fail(normalized.message);
    try {
      const result = await this.repository.updateOrder(id, legacyUserId, normalized);
      if (result === 'not-found') return this.fail('Orden de gastos no encontrada');
      if (result === 'invalid-state' || result === 'not-editable') return this.fail('Solo se pueden editar órdenes activas sin aprobar ni imprimir');
      return { success: true, data: { id }, message: 'Orden de gastos actualizada correctamente' };
    } catch (error) { return this.handleError(error); }
  }

  async getPrintData(rawId: unknown, roleId: number): Promise<ExpenseOrderResponse<ExpenseOrderPrintData>> {
    const moduleForbidden = await this.requireModuleAccess(roleId);
    if (moduleForbidden) return moduleForbidden;
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.fail('Orden de gastos no encontrada');
    try {
      const [header, details] = await Promise.all([this.repository.findOrderById(id), this.repository.findDetails(id)]);
      if (!header) return this.fail('Orden de gastos no encontrada');
      const forbidden = await this.requirePrintAccess(roleId, Number(header.aprobada ?? 0));
      if (forbidden) return forbidden;
      const valor = this.round2(Number(header.valor ?? 0));
      const porcDescuento = Number(header.descuento ?? 0);
      const porcIva = Number(header.iva ?? 0);
      const descuento = this.round2(valor * (porcDescuento / 100));
      const subtotal = this.round2(valor - descuento);
      const total = this.round2(Number(header.total ?? subtotal + subtotal * (porcIva / 100)));
      const iva = this.round2(total - subtotal);
      const numImpresiones = Number(header.numImpresiones ?? -1);
      return { success: true, data: { order: { id, fecha: this.toIsoDate(header.fecha), estado: header.estado ?? null, copyLabel: numImpresiones < 0 ? 'ORIGINAL' : 'DUPLICADO', observacion: header.observacion ?? null, aprobada: Number(header.aprobada ?? 0) === 1, numImpresiones }, provider: { name: header.proveedor ?? null, nit: header.proveedorDocumento ?? null }, service: header.servicio ?? null, user: header.usuario ?? null, details: details.map((d) => ({ idDetalle: Number(d.idDetalle), detalle: d.detalle ?? '', cantidad: Number(d.cantidad ?? 1), valor: Number(d.valor ?? 0) })), totals: { valor, descuento, subtotal, iva, total, porcDescuento, porcIva } }, message: null };
    } catch (error) { return this.handleError(error); }
  }

  async printOrder(userId: number, roleId: number, rawId: unknown): Promise<ExpenseOrderResponse<{ id: number }>> {
    const moduleForbidden = await this.requireModuleAccess(roleId);
    if (moduleForbidden) return moduleForbidden;
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.fail('Orden de gastos no encontrada');
    const legacyUserId = await this.repository.findLegacyUserId(userId);
    if (!legacyUserId) return this.fail('No se encontró el usuario legacy asociado a la sesión');
    try {
      const header = await this.repository.findOrderById(id);
      if (!header) return this.fail('Orden de gastos no encontrada');
      const forbidden = await this.requirePrintAccess(roleId, Number(header.aprobada ?? 0));
      if (forbidden) return forbidden;
      const result = await this.repository.markPrinted(id, legacyUserId);
      if (result === 'not-found') return this.fail('Orden de gastos no encontrada');
      return { success: true, data: { id }, message: 'Orden marcada como impresa' };
    } catch (error) { return this.handleError(error); }
  }

  async approveOrder(roleId: number, rawId: unknown): Promise<ExpenseOrderResponse<{ id: number }>> {
    const forbidden = await this.requireAction(roleId, 'approve', 'No tienes permiso para aprobar órdenes de gastos');
    if (forbidden) return forbidden;
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.fail('Orden de gastos no encontrada');
    try {
      const result = await this.repository.approve(id);
      if (result === 'not-found') return this.fail('Orden de gastos no encontrada');
      if (result === 'canceled') return this.fail('No se puede aprobar una orden anulada');
      return { success: true, data: { id }, message: 'Orden aprobada correctamente' };
    } catch (error) { return this.handleError(error); }
  }

  async approveBulk(roleId: number, files?: ExpenseOrderApproveBulkFile[]): Promise<ExpenseOrderResponse<ExpenseOrderApproveBulkResult>> {
    const forbidden = await this.requireAction(roleId, 'approve-bulk', 'No tienes permiso para aprobar órdenes de gastos en lote');
    if (forbidden) return forbidden;
    if (!files?.length) return this.fail('Selecciona un archivo Excel para cargar');
    try {
      const ids = files.flatMap((file) => this.parseApproveBulkFile(file));
      const uniqueCount = new Set(ids).size;
      const approved = await this.repository.approveBulk(ids);
      const skipped = Math.max(0, uniqueCount - approved);
      const message = approved > 0
        ? `${approved} órdenes aprobadas. ${skipped} omitidas.`
        : 'Ninguna orden aprobada.';
      return { success: true, data: { parsed: ids.length, approved, skipped, files: files.length }, message };
    } catch (error) { return this.handleError(error); }
  }

  async anuleOrder(userId: number, roleId: number, rawId: unknown): Promise<ExpenseOrderResponse<{ id: number }>> {
    const forbidden = await this.requireAction(roleId, 'anule', 'No tienes permiso para anular órdenes de gastos');
    if (forbidden) return forbidden;
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.fail('Orden de gastos no encontrada');
    const legacyUserId = await this.repository.findLegacyUserId(userId);
    if (!legacyUserId) return this.fail('No se encontró el usuario legacy asociado a la sesión');
    try {
      const result = await this.repository.anule(id, legacyUserId);
      if (result === 'not-found') return this.fail('Orden de gastos no encontrada');
      if (result === 'already-canceled') return this.fail('La orden ya está anulada');
      if (result === 'invalid-state') return this.fail('No se puede anular una orden en estado 39');
      if (result === 'sequence-not-found') return this.fail('No se encontró el consecutivo de anulación anulacion_og');
      return { success: true, data: { id }, message: 'Orden anulada correctamente' };
    } catch (error) { return this.handleError(error); }
  }

  async setRecurrence(roleId: number, rawId: unknown, payload: ExpenseOrderRecurrencePayload): Promise<ExpenseOrderResponse<{ id: number }>> {
    const forbidden = await this.requireAction(roleId, 'recurrence', 'No tienes permiso para gestionar recurrencia');
    if (forbidden) return forbidden;
    const id = this.toPositiveInteger(rawId);
    const inicio = this.toDateString(payload?.inicioRecurrencia);
    const fin = this.toDateString(payload?.finRecurrencia);
    if (!id || !inicio || !fin) return this.fail('Inicio y fin de recurrencia son obligatorios');
    try { const result = await this.repository.setRecurrence(id, inicio, fin); return result === 'ok' ? { success: true, data: { id }, message: 'Recurrencia guardada correctamente' } : this.fail('Orden de gastos no encontrada'); } catch (error) { return this.handleError(error); }
  }

  async clearRecurrence(roleId: number, rawId: unknown): Promise<ExpenseOrderResponse<{ id: number }>> {
    const forbidden = await this.requireAction(roleId, 'recurrence', 'No tienes permiso para gestionar recurrencia');
    if (forbidden) return forbidden;
    const id = this.toPositiveInteger(rawId);
    if (!id) return this.fail('Orden de gastos no encontrada');
    try { const result = await this.repository.clearRecurrence(id); return result === 'ok' ? { success: true, data: { id }, message: 'Recurrencia eliminada correctamente' } : this.fail('Orden de gastos no encontrada'); } catch (error) { return this.handleError(error); }
  }

  private normalizeListItem(row: ExpenseOrderRow, roleActions: Set<string>): ExpenseOrderListItem {
    const idEstado = row.idEstado === null || row.idEstado === undefined ? null : Number(row.idEstado);
    return { id: Number(row.id), fecha: this.toIsoDate(row.fecha), estado: row.estado ?? null, estadoColor: Number(row.aprobada ?? 0) === 1 ? 'success' : row.estadoColor ?? null, idEstado, proveedor: row.proveedor ?? null, usuario: row.usuario?.trim() || null, servicio: row.servicio ?? null, total: Number(row.total ?? 0), aprobada: Number(row.aprobada ?? 0) === 1, recurrente: Number(row.recurrente ?? 0) > 0, permittedActions: this.resolvePermittedActions(roleActions, idEstado, Number(row.aprobada ?? 0), Number(row.numImpresiones ?? -1)) };
  }

  private normalizeDetail(header: any, details: any[], roleActions: Set<string>): ExpenseOrderDetailData {
    const idEstado = header.idEstado === null || header.idEstado === undefined ? null : Number(header.idEstado);
    const aprobada = Number(header.aprobada ?? 0);
    const numImpresiones = Number(header.numImpresiones ?? -1);
    const editable = idEstado === EXPENSE_ORDER_STATUS.ACTIVE && aprobada !== 1 && numImpresiones === -1;
    return { id: Number(header.id), fecha: this.toIsoDate(header.fecha), estado: header.estado ?? null, estadoColor: header.estadoColor ?? null, idEstado, editable, idProveedor: header.idProveedor === null ? null : Number(header.idProveedor), proveedor: header.proveedor ?? null, idServicio: header.idServicio === null ? null : Number(header.idServicio), servicio: header.servicio ?? null, observacion: header.observacion ?? null, descuento: Number(header.descuento ?? 0), iva: Number(header.iva ?? 0), valor: Number(header.valor ?? 0), total: Number(header.total ?? 0), aprobada: aprobada === 1, recurrente: Number(header.recurrente ?? 0) > 0, inicioRecurrencia: this.toIsoDate(header.inicioRecurrencia), finRecurrencia: this.toIsoDate(header.finRecurrencia), fechaAnulacion: this.toIsoDate(header.fechaAnulacion), consecutivoAnulacion: header.consecutivoAnulacion === null || header.consecutivoAnulacion === undefined ? null : Number(header.consecutivoAnulacion), detalles: details.map((d) => ({ idDetalle: Number(d.idDetalle), detalle: d.detalle ?? '', cantidad: Number(d.cantidad ?? 1), valor: Number(d.valor ?? 0) })), permittedActions: this.resolvePermittedActions(roleActions, idEstado, aprobada, numImpresiones) };
  }

  private resolvePermittedActions(roleActions: Set<string>, idEstado: number | null, aprobada: number, numImpresiones: number): string[] {
    const actions: string[] = [];
    for (const action of roleActions) {
      if (MODULE_LEVEL_ACTIONS.has(action) || action === 'approve-bulk') continue;
      if (action === 'edit' && idEstado !== EXPENSE_ORDER_STATUS.ACTIVE) { if (idEstado === EXPENSE_ORDER_STATUS.CANCELED) actions.push('view-canceled'); continue; }
      if (action === 'edit' && (aprobada === 1 || numImpresiones !== -1)) continue;
      if (action === 'print' && aprobada !== 1) continue;
      if (action === PRINT_PREVIEW_ACTION && aprobada === 1) continue;
      if (action === 'approve' && (aprobada === 1 || idEstado === EXPENSE_ORDER_STATUS.CANCELED)) continue;
      if (action === 'anule' && (idEstado === EXPENSE_ORDER_STATUS.CANCELED || idEstado === EXPENSE_ORDER_STATUS.LOCKED)) continue;
      actions.push(action);
    }
    return actions;
  }

  private normalizePayload(payload: ExpenseOrderPayload): NormalizedExpenseOrderPayload | { message: string } {
    const idProveedor = this.toPositiveInteger(payload?.idProveedor);
    const includesService = Object.prototype.hasOwnProperty.call(payload ?? {}, 'idServicio');
    const idServicio = includesService ? this.toPositiveInteger(payload?.idServicio) : undefined;
    const descuento = this.toNumber(payload?.descuento, 0);
    const iva = this.toNumber(payload?.iva, FALLBACK_IVA);
    if (!idProveedor) return { message: 'El proveedor es obligatorio' };
    if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100 || !Number.isFinite(iva) || iva < 0 || iva > 100) return { message: 'IVA y descuento deben estar entre 0 y 100' };
    const details = Array.isArray(payload?.detalles) ? payload.detalles.map((item: any) => ({ idDetalle: this.toPositiveInteger(item?.idDetalle) ?? undefined, detalle: this.toString(item?.detalle) ?? '', cantidad: 1, valor: this.toNumber(item?.valor, NaN) })).filter((item) => item.detalle || Number.isFinite(item.valor)) : [];
    for (const detail of details) { if (!detail.detalle || !Number.isFinite(detail.valor) || detail.valor <= 0) return { message: 'Cada detalle debe tener descripción y valor mayor a cero' }; }
    return { idProveedor, idServicio, observacion: this.toString(payload?.observacion), descuento, iva, details };
  }

  private parseApproveBulkFile(file: ExpenseOrderApproveBulkFile): number[] {
    const name = file.originalname ?? '';
    if (!/\.(xls|xlsx)$/i.test(name)) throw new Error('EXPENSE_ORDERS_INVALID_APPROVE_BULK_FILE');
    if (!file.buffer?.length) throw new Error('EXPENSE_ORDERS_EMPTY_APPROVE_BULK_FILE');
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch {
      throw new Error('EXPENSE_ORDERS_INVALID_APPROVE_BULK_FILE');
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const ids: number[] = [];
    for (let row = 2; ; row += 1) {
      const firstColumn = this.cellText(sheet[`A${row}`]);
      if (!firstColumn) break;
      const marker = this.cellText(sheet[`O${row}`]);
      const orderId = this.toPositiveInteger(this.cellText(sheet[`B${row}`]));
      if (marker === 'OK' && orderId) ids.push(orderId);
    }
    return ids;
  }

  private cellText(cell: XLSX.CellObject | undefined): string {
    if (!cell || cell.v === null || cell.v === undefined) return '';
    return String(cell.v).trim();
  }

  private async hasAction(roleId: number, action: string): Promise<boolean> { return (await this.permissionsService.getRoleModuleActions(roleId, EXPENSE_ORDERS_MODULE)).has(action); }
  private async requireModuleAccess(roleId: number): Promise<ExpenseOrderResponse<any> | null> { return await this.permissionsService.hasMenuAccess(roleId, EXPENSE_ORDERS_MENU_CODES) ? null : { success: false, data: null, message: 'No tienes permiso para consultar órdenes de gastos', errorCode: 'EXPENSE_ORDERS_FORBIDDEN' }; }
  private async requireAction(roleId: number, action: string, message: string): Promise<ExpenseOrderResponse<any> | null> {
    const forbidden = await this.requireModuleAccess(roleId);
    if (forbidden) return forbidden;
    return await this.hasAction(roleId, action) ? null : { success: false, data: null, message, errorCode: 'EXPENSE_ORDERS_FORBIDDEN' };
  }
  private async requirePrintAccess(roleId: number, aprobada: number): Promise<ExpenseOrderResponse<any> | null> {
    const action = aprobada === 1 ? 'print' : PRINT_PREVIEW_ACTION;
    const message = aprobada === 1 ? 'No tienes permiso para imprimir órdenes de gastos' : 'No tienes permiso para previsualizar órdenes de gastos';
    return await this.hasAction(roleId, action) ? null : { success: false, data: null, message, errorCode: 'EXPENSE_ORDERS_FORBIDDEN' };
  }
  private async optionResponse(loader: () => Promise<{ id: number; label: string }[]>): Promise<ExpenseOrderResponse<{ id: number; label: string }[]>> { try { const rows = await loader(); return { success: true, data: rows.map((r) => ({ id: Number(r.id), label: r.label })), message: null }; } catch (error) { return this.handleError(error); } }
  private fail<T = any>(message: string): ExpenseOrderResponse<T> { return { success: false, data: null, message, errorCode: 'EXPENSE_ORDERS_VALIDATION' }; }
  private handleError(error: unknown): ExpenseOrderResponse<any> {
    console.error('Expense orders error', error);
    if (this.isMissingDatabaseUserError(error)) {
      return { success: false, data: null, message: 'No se pudo procesar órdenes de gastos: revisar el disparador de auditoría inserOrdgasto en la base de datos.', errorCode: 'EXPENSE_ORDERS_SERVER_ERROR' };
    }
    if (this.isApproveBulkFileError(error)) {
      return { success: false, data: null, message: 'El archivo debe ser Excel .xls o .xlsx válido', errorCode: 'EXPENSE_ORDERS_VALIDATION' };
    }
    return { success: false, data: null, message: 'No se pudo procesar órdenes de gastos', errorCode: 'EXPENSE_ORDERS_SERVER_ERROR' };
  }
  private isApproveBulkFileError(error: unknown): boolean {
    return error instanceof Error && (error.message === 'EXPENSE_ORDERS_INVALID_APPROVE_BULK_FILE' || error.message === 'EXPENSE_ORDERS_EMPTY_APPROVE_BULK_FILE');
  }
  private isMissingDatabaseUserError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ER_NO_SUCH_USER';
  }
  private toPositiveInteger(value: unknown): number | null { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; }
  private toNumber(value: unknown, fallback: number): number { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  private toString(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
  private toDateString(value: unknown): string | null { return typeof value === 'string' && DATE_PATTERN.test(value.trim()) ? value.trim() : null; }
  private toIsoDate(value: unknown): string | null { if (!value) return null; if (value instanceof Date) return value.toISOString().slice(0, 10); const text = String(value); return text.includes('T') ? text.slice(0, 10) : text.slice(0, 10); }
  private round2(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
}
