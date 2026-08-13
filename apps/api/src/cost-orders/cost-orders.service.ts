import { Injectable } from '@nestjs/common';
import { PermissionsService } from '../permissions/permissions.service';
import { CostOrderFilters, CostOrdersRepository } from './cost-orders.repository';
import {
  CostOrderCreatePayload,
  CostOrderDetailData,
  CostOrderDetailRow,
  CostOrderHeaderRow,
  CostOrderListData,
  CostOrderListItem,
  CostOrderListQuery,
  CostOrderResponse,
  CostOrderRow,
  CostOrderUpdatePayload,
} from './cost-orders.types';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const COST_ORDERS_MODULE = 'cost-orders';

// Reglas de negocio por estado (invariantes del dominio, NO configurables por permiso).
// Un action_code sin entrada aquí no depende del estado (solo del permiso del rol).
// id_estado: 1=ACTIVO, 4=ANULADO, 8=FINALIZADO, 25=PENDIENTE, 27=IMPRESO, 28=Doc E.
const ACTION_STATE_RULES: Record<string, number[]> = {
  edit: [1],
  anule: [1, 27],
  replace: [8, 27],
};

// Acciones a nivel de MÓDULO (no dependen de una orden puntual): se resuelven una sola vez,
// no por fila. "create" (Nueva orden) y "duplicate" (botón separado, duplica en masa desde su
// propio modal). El resto son acciones de fila (por orden).
const MODULE_LEVEL_ACTIONS = new Set(['create', 'duplicate']);

@Injectable()
export class CostOrdersService {
  constructor(
    private readonly costOrdersRepository: CostOrdersRepository,
    private readonly permissionsService: PermissionsService,
  ) {}

  async listOrders(roleId: number, query: CostOrderListQuery): Promise<CostOrderResponse<CostOrderListData>> {
    const page = this.toPositiveInteger(query.page) ?? 1;
    const pageSize = Math.min(this.toPositiveInteger(query.pageSize) ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;

    const filters: CostOrderFilters = {
      search: this.toSearchString(query.search),
      estado: this.toPositiveInteger(query.estado),
      proveedor: this.toPositiveInteger(query.proveedor),
      fechaIni: this.toDateString(query.fechaIni),
      fechaFin: this.toDateString(query.fechaFin),
    };

    // Solo aplicar rango de fechas si ambos extremos son válidos.
    if (!filters.fechaIni || !filters.fechaFin) {
      filters.fechaIni = null;
      filters.fechaFin = null;
    }

    try {
      const [rows, total, roleActions] = await Promise.all([
        this.costOrdersRepository.findOrders(filters, pageSize, offset),
        this.costOrdersRepository.countOrders(filters),
        this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE),
      ]);

      // Acciones de módulo permitidas para el rol (ej. create), resueltas una sola vez.
      const moduleActions = [...roleActions].filter((action) => MODULE_LEVEL_ACTIONS.has(action));

      return {
        success: true,
        data: {
          items: rows.map((row) => this.normalizeOrder(row, roleActions)),
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
          moduleActions,
        },
        message: null,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Acciones de FILA permitidas = permiso del rol ∩ regla de estado, excluyendo las de módulo.
  private resolvePermittedActions(roleActions: Set<string>, idEstado: number | null): string[] {
    const result: string[] = [];
    for (const action of roleActions) {
      if (MODULE_LEVEL_ACTIONS.has(action)) continue; // create no va en el menú por fila
      const allowedStates = ACTION_STATE_RULES[action];
      if (allowedStates && (idEstado === null || !allowedStates.includes(idEstado))) {
        continue; // la acción existe para el rol pero el estado no la permite
      }
      result.push(action);
    }
    return result;
  }

  async getStatuses(): Promise<CostOrderResponse<{ id: number; label: string }[]>> {
    try {
      const rows = await this.costOrdersRepository.findStatuses();
      return { success: true, data: rows.map((row) => ({ id: Number(row.id), label: row.label })), message: null };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // --- Dropdowns del formulario de creación ---

  async getClients(search: unknown): Promise<CostOrderResponse<{ id: number; label: string }[]>> {
    return this.optionResponse(() => this.costOrdersRepository.findClients(this.toSearchString(search), 30));
  }

  async getProviders(search: unknown): Promise<CostOrderResponse<{ id: number; label: string }[]>> {
    return this.optionResponse(() => this.costOrdersRepository.findProviders(this.toSearchString(search), 30));
  }

  async getServices(tipo: unknown): Promise<CostOrderResponse<{ id: number; label: string }[]>> {
    const normalized = tipo === 'E' ? 'E' : 'I';
    return this.optionResponse(() => this.costOrdersRepository.findServices(normalized));
  }

  async getCampaigns(clientId: unknown): Promise<CostOrderResponse<{ id: number; label: string }[]>> {
    const id = this.toPositiveInteger(clientId);
    if (!id) return { success: true, data: [], message: null };
    return this.optionResponse(() => this.costOrdersRepository.findCampaigns(id));
  }

  async getProducts(clientId: unknown): Promise<CostOrderResponse<{ id: number; label: string }[]>> {
    const id = this.toPositiveInteger(clientId);
    if (!id) return { success: true, data: [], message: null };
    return this.optionResponse(() => this.costOrdersRepository.findProducts(id));
  }

  // --- Crear orden (cabecera + detalle en una transacción) ---

  async createOrder(
    userId: number,
    roleId: number,
    payload: CostOrderCreatePayload,
  ): Promise<CostOrderResponse<{ id: number }>> {
    // 1) Permiso: el rol debe tener la acción 'create' (root implícito).
    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('create')) {
      return { success: false, data: null, message: 'No tienes permiso para crear órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    // 2) Validación de campos.
    const idCliente = this.toPositiveInteger(payload.idCliente);
    const idProveedor = this.toPositiveInteger(payload.idProveedor);
    const idProducto = this.toPositiveInteger(payload.idProducto);
    const idCampana = this.toPositiveInteger(payload.idCampana);
    const idServicio = this.toPositiveInteger(payload.idServicio);
    const tipo = payload.tipo === 'E' ? 'E' : payload.tipo === 'I' ? 'I' : null;
    const observacion = this.toSearchString(payload.observacion);
    const porcIva = this.toNumber(payload.porcIva, 19);
    const porcDescuento = this.toNumber(payload.porcDescuento, 0);

    if (!idCliente || !idProveedor || !idProducto || !idCampana || !idServicio || !tipo) {
      return { success: false, data: null, message: 'Cliente, proveedor, producto, campaña, servicio y tipo son obligatorios', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    if (porcIva < 0 || porcIva > 100 || porcDescuento < 0 || porcDescuento > 100) {
      return { success: false, data: null, message: 'IVA y descuento deben estar entre 0 y 100', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    // 3) Detalle (opcional en la creación, pero si viene debe ser válido).
    const details = this.normalizeDetails(payload.detalles);
    if (details === null) {
      return { success: false, data: null, message: 'El detalle de la orden es inválido', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    try {
      // Validar existencia de cliente/proveedor (evita FKs basura).
      const [clientOk, providerOk] = await Promise.all([
        this.costOrdersRepository.clientExists(idCliente, 'cliente'),
        this.costOrdersRepository.clientExists(idProveedor, 'proveedor'),
      ]);
      if (!clientOk) return { success: false, data: null, message: 'El cliente seleccionado no existe o está inactivo', errorCode: 'COST_ORDERS_VALIDATION' };
      if (!providerOk) return { success: false, data: null, message: 'El proveedor seleccionado no existe o está inactivo', errorCode: 'COST_ORDERS_VALIDATION' };

      // 4) Cálculo de totales (misma fórmula del legacy ValorTotal).
      const valor = details.reduce((sum, d) => sum + d.total, 0);
      const descuento = valor * (porcDescuento / 100);
      const iva = (valor - descuento) * (porcIva / 100);
      const total = valor - descuento + iva;

      const id = await this.costOrdersRepository.createOrder(
        {
          fecha: new Date().toISOString().slice(0, 10),
          idCliente, idProveedor, idProducto, idCampana, idServicio,
          idEstado: 1, // ACTIVO (borrador), como el legacy
          idUsuario: userId,
          tipo,
          observacion: observacion || null,
          porcIva, porcDescuento,
          valor: this.round2(valor),
          total: this.round2(total),
        },
        details,
      );

      return { success: true, data: { id }, message: 'Orden de costo creada correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // --- Edición ---

  async getOrderForEdit(id: number): Promise<CostOrderResponse<CostOrderDetailData>> {
    const orderId = this.toPositiveInteger(id);
    if (!orderId) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    try {
      const header = await this.costOrdersRepository.findOrderById(orderId);
      if (!header) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

      const details = await this.costOrdersRepository.findOrderDetails(orderId);
      return { success: true, data: this.normalizeOrderDetail(header, details), message: null };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateOrder(
    userId: number,
    roleId: number,
    rawId: unknown,
    payload: CostOrderUpdatePayload,
  ): Promise<CostOrderResponse<{ id: number }>> {
    const id = this.toPositiveInteger(rawId);
    if (!id) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    // Permiso 'edit'.
    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('edit')) {
      return { success: false, data: null, message: 'No tienes permiso para editar órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    // Validación de campos (misma que create, salvo tipo que no se edita).
    const idCliente = this.toPositiveInteger(payload.idCliente);
    const idProveedor = this.toPositiveInteger(payload.idProveedor);
    const idProducto = this.toPositiveInteger(payload.idProducto);
    const idCampana = this.toPositiveInteger(payload.idCampana);
    const idServicio = this.toPositiveInteger(payload.idServicio);
    const observacion = this.toSearchString(payload.observacion);
    const porcIva = this.toNumber(payload.porcIva, 19);
    const porcDescuento = this.toNumber(payload.porcDescuento, 0);

    if (!idCliente || !idProveedor || !idProducto || !idCampana || !idServicio) {
      return { success: false, data: null, message: 'Cliente, proveedor, producto, campaña y servicio son obligatorios', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    if (porcIva < 0 || porcIva > 100 || porcDescuento < 0 || porcDescuento > 100) {
      return { success: false, data: null, message: 'IVA y descuento deben estar entre 0 y 100', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    const details = this.normalizeDetails(payload.detalles);
    if (details === null) {
      return { success: false, data: null, message: 'El detalle de la orden es inválido', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    try {
      // Solo se puede editar en estado 1 (borrador).
      const current = await this.costOrdersRepository.findOrderById(id);
      if (!current) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (Number(current.idEstado) !== 1) {
        return { success: false, data: null, message: 'Solo se pueden editar órdenes en estado borrador (Activo)', errorCode: 'COST_ORDERS_VALIDATION' };
      }

      const [clientOk, providerOk] = await Promise.all([
        this.costOrdersRepository.clientExists(idCliente, 'cliente'),
        this.costOrdersRepository.clientExists(idProveedor, 'proveedor'),
      ]);
      if (!clientOk) return { success: false, data: null, message: 'El cliente seleccionado no existe o está inactivo', errorCode: 'COST_ORDERS_VALIDATION' };
      if (!providerOk) return { success: false, data: null, message: 'El proveedor seleccionado no existe o está inactivo', errorCode: 'COST_ORDERS_VALIDATION' };

      // Recalcular valor = suma de líneas nuevas (sin ppto) + líneas preservadas (con ppto).
      const budgetTotal = await this.costOrdersRepository.sumBudgetLineTotals(id);
      const manualTotal = details.reduce((sum, d) => sum + d.total, 0);
      const valor = budgetTotal + manualTotal;
      const descuento = valor * (porcDescuento / 100);
      const iva = (valor - descuento) * (porcIva / 100);
      const total = valor - descuento + iva;

      await this.costOrdersRepository.updateOrder(
        id,
        {
          idCliente, idProveedor, idProducto, idCampana, idServicio,
          observacion: observacion || null, porcIva, porcDescuento,
          valor: this.round2(valor), total: this.round2(total), idUsuario: userId,
        },
        details,
      );

      return { success: true, data: { id }, message: 'Orden de costo actualizada correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private normalizeOrderDetail(header: CostOrderHeaderRow, details: CostOrderDetailRow[]): CostOrderDetailData {
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return {
      id: Number(header.id),
      idEstado: num(header.idEstado),
      estado: header.estado ?? null,
      editable: Number(header.idEstado) === 1,
      idCliente: num(header.idCliente),
      cliente: header.cliente ?? null,
      idProveedor: num(header.idProveedor),
      proveedor: header.proveedor ?? null,
      idCampana: num(header.idCampana),
      campana: header.campana ?? null,
      idProducto: num(header.idProducto),
      producto: header.producto ?? null,
      idServicio: num(header.idServicio),
      servicio: header.servicio ?? null,
      tipo: header.tipo === 'I' ? 'INTERNA' : header.tipo ? 'EXTERNA' : null,
      observacion: header.observacion ?? null,
      porcIva: Number(header.porcIva ?? 19),
      porcDescuento: Number(header.porcDescuento ?? 0),
      valor: Number(header.valor ?? 0),
      total: Number(header.total ?? 0),
      detalles: details.map((d) => ({
        idDetalle: Number(d.idDetalle),
        detalle: d.detalle,
        cantidad: Number(d.cantidad),
        valor: Number(d.valor),
        total: Number(d.total),
        hasBudget: Number(d.hasBudget) === 1,
      })),
    };
  }

  private async optionResponse(
    fetch: () => Promise<{ id: number; label: string }[]>,
  ): Promise<CostOrderResponse<{ id: number; label: string }[]>> {
    try {
      const rows = await fetch();
      return { success: true, data: rows.map((r) => ({ id: Number(r.id), label: r.label })), message: null };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Normaliza y valida líneas de detalle. Devuelve null si algo es inválido.
  private normalizeDetails(value: unknown): { detalle: string; cantidad: number; valor: number; total: number }[] | null {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) return null;

    const result: { detalle: string; cantidad: number; valor: number; total: number }[] = [];
    for (const raw of value) {
      if (typeof raw !== 'object' || raw === null) return null;
      const item = raw as Record<string, unknown>;
      const detalle = this.toSearchString(item.detalle);
      const cantidad = this.toPositiveInteger(item.cantidad);
      const valor = this.toNumber(item.valor, NaN);
      if (!detalle || !cantidad || !Number.isFinite(valor) || valor < 0) return null;
      result.push({ detalle, cantidad, valor: this.round2(valor), total: this.round2(valor * cantidad) });
    }
    return result;
  }

  private toNumber(value: unknown, fallback: number): number {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private normalizeOrder(row: CostOrderRow, roleActions: Set<string>): CostOrderListItem {
    const idEstado = row.idEstado === null || row.idEstado === undefined ? null : Number(row.idEstado);
    return {
      id: Number(row.id),
      fecha: this.toIsoDate(row.fecha),
      estado: row.estado ?? null,
      estadoColor: row.color ?? null,
      idEstado,
      cliente: row.cliente ?? null,
      proveedor: row.proveedor ?? null,
      campana: row.campana ?? null,
      usuario: row.usuario ?? null,
      tipo: row.tipo === 'I' ? 'INTERNA' : row.tipo ? 'EXTERNA' : null,
      total: row.total === null || row.total === undefined ? 0 : Number(row.total),
      permittedActions: this.resolvePermittedActions(roleActions, idEstado),
    };
  }

  private toIsoDate(value: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }

  private toPositiveInteger(value: unknown): number | null {
    if (Array.isArray(value)) return null;
    const normalized = typeof value === 'string' ? value.trim() : value;
    if (normalized === '' || normalized === null || normalized === undefined) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private toSearchString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private toDateString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return DATE_PATTERN.test(trimmed) ? trimmed : null;
  }

  private handleError(error: unknown): CostOrderResponse<never> {
    if (typeof error === 'object' && error !== null && ('code' in error || 'errno' in error || 'sqlState' in error)) {
      const databaseError = error as Record<string, unknown>;
      console.error('Cost orders database error', {
        code: databaseError.code,
        errno: databaseError.errno,
        sqlState: databaseError.sqlState,
      });
      return {
        success: false,
        data: null,
        message: 'No se pudo cargar Órdenes de costo en este momento',
        errorCode: 'COST_ORDERS_SERVER_ERROR',
      };
    }
    throw error;
  }
}
