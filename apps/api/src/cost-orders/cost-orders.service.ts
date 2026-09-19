import { Injectable } from '@nestjs/common';
import { PermissionsService } from '../permissions/permissions.service';
import { BUDGET_STATUS, BUDGET_STRUCTURES, COST_ORDER_STATUS, CostOrderFilters, CostOrdersRepository } from './cost-orders.repository';
import {
  CostOrderBudgetAttachPayload,
  CostOrderBudgetSearchQuery,
  CostOrderCompensateData,
  CostOrderCompensatePayload,
  CostOrderCompensateQuery,
  CostOrderCompensateReversePayload,
  CostOrderCompensateSuggestion,
  CostOrderCreatePayload,
  CostOrderDefaultsData,
  CostOrderDetailData,
  CostOrderDetailRow,
  CostOrderDuplicateCandidate,
  CostOrderDuplicatePayload,
  CostOrderFinalObservationPayload,
  CostOrderHeaderRow,
  CostOrderListData,
  CostOrderListItem,
  CostOrderListQuery,
  CostOrderPrintData,
  CostOrderPrintMutationData,
  CostOrderResponse,
  CostOrderRow,
  CostOrderUpdatePayload,
} from './cost-orders.types';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const DUPLICATE_CANDIDATES_LIMIT = 100;
const DUPLICATE_ORDERS_LIMIT = 100;
const FINAL_OBSERVATION_MAX_LENGTH = 3000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_COMPANY = {
  name: 'SONOVISTA PUBLICIDAD S.A.',
  commercialName: 'Sonovista Publicidad S.A.',
  nit: null,
  address: null,
  city: 'Bogotá D.C.',
  department: null,
  country: 'Colombia',
  phone: null,
};

export const COST_ORDERS_MODULE = 'cost-orders';

// Reglas de negocio por estado (invariantes del dominio, NO configurables por permiso).
// Un action_code sin entrada aquí no depende del estado (solo del permiso del rol).
// id_estado: 1=ACTIVO, 4=ANULADO, 8=FINALIZADO, 25=PENDIENTE, 27=IMPRESO, 28=Doc E.
const ACTION_STATE_RULES: Record<string, number[]> = {
  edit: [COST_ORDER_STATUS.ACTIVE],
  finish: [COST_ORDER_STATUS.ACTIVE, COST_ORDER_STATUS.PRINTED],
  anule: [COST_ORDER_STATUS.ACTIVE, COST_ORDER_STATUS.PRINTED],
  replace: [COST_ORDER_STATUS.FINALIZED, COST_ORDER_STATUS.PRINTED],
};

// Acciones a nivel de MÓDULO (no dependen de una orden puntual): se resuelven una sola vez,
// no por fila. "create" (Nueva orden) y "duplicate" (botón separado, duplica en masa desde su
// propio modal). El resto son acciones de fila (por orden).
const MODULE_LEVEL_ACTIONS = new Set(['create', 'duplicate', 'compensate']);
const COMPENSATE_BLOCKED_STATES = [COST_ORDER_STATUS.FINALIZED, COST_ORDER_STATUS.PENDING, COST_ORDER_STATUS.CANCELED] as const;

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
  private resolvePermittedActions(roleActions: Set<string>, idEstado: number | null, hasBudgetLinks = false): string[] {
    const result: string[] = [];
    for (const action of roleActions) {
      if (MODULE_LEVEL_ACTIONS.has(action)) continue; // create no va en el menú por fila
      if (action === 'download') continue; // decisión de producto: no exponer descarga en el sistema nuevo
      if (action === 'anule' && hasBudgetLinks) continue; // legacy advertía; el sistema nuevo oculta y backend bloquea
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

  async getDefaults(): Promise<CostOrderResponse<CostOrderDefaultsData>> {
    try {
      const row = await this.costOrdersRepository.findDefaults();
      const porcIva = this.toNumber(row?.iva, NaN);
      if (!Number.isFinite(porcIva) || porcIva < 0 || porcIva > 100) {
        return {
          success: false,
          data: null,
          message: 'No hay un IVA válido configurado para órdenes de costo',
          errorCode: 'COST_ORDERS_VALIDATION',
        };
      }
      return { success: true, data: { porcIva }, message: null };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getDuplicateCandidates(roleId: number, rawSearch: unknown): Promise<CostOrderResponse<CostOrderDuplicateCandidate[]>> {
    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('duplicate')) {
      return { success: false, data: null, message: 'No tienes permiso para duplicar órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const rows = await this.costOrdersRepository.findDuplicateCandidates(this.toSearchString(rawSearch), DUPLICATE_CANDIDATES_LIMIT);
      return {
        success: true,
        data: rows.map((row) => ({
          id: Number(row.id),
          fecha: this.toIsoDate(row.fecha),
          cliente: row.cliente ?? null,
          proveedor: row.proveedor ?? null,
          campana: row.campana ?? null,
          total: Number(row.total ?? 0),
        })),
        message: null,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async duplicateOrders(
    userId: number,
    roleId: number,
    payload: CostOrderDuplicatePayload,
  ): Promise<CostOrderResponse<{ createdIds: number[] }>> {
    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('duplicate')) {
      return { success: false, data: null, message: 'No tienes permiso para duplicar órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    const orderIds = this.normalizeIds(payload.orderIds);
    if (!orderIds.length) {
      return { success: false, data: null, message: 'Selecciona al menos una orden de los últimos 3 meses', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    if (orderIds.length > DUPLICATE_ORDERS_LIMIT) {
      return { success: false, data: null, message: `Puedes duplicar máximo ${DUPLICATE_ORDERS_LIMIT} órdenes a la vez`, errorCode: 'COST_ORDERS_VALIDATION' };
    }

    try {
      const result = await this.costOrdersRepository.duplicateOrders(orderIds, userId);
      if (result === 'invalid-source') {
        return { success: false, data: null, message: 'Una o más órdenes no existen o no están dentro de los últimos 3 meses', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      return { success: true, data: result, message: 'Órdenes duplicadas correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getFinalObservation(roleId: number, rawId: unknown): Promise<CostOrderResponse<{ obsFinal: string | null }>> {
    const orderId = this.toPositiveInteger(rawId);
    if (!orderId) return { success: false, data: null, message: 'Orden de costo no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('add-obs')) {
      return { success: false, data: null, message: 'No tienes permiso para gestionar la observación final', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const obsFinal = await this.costOrdersRepository.findFinalObservation(orderId);
      if (obsFinal === undefined) return { success: false, data: null, message: 'Orden de costo no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      return { success: true, data: { obsFinal: obsFinal || null }, message: null };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async addFinalObservation(userId: number, roleId: number, rawId: unknown, payload: CostOrderFinalObservationPayload | undefined): Promise<CostOrderResponse<{ id: number }>> {
    const orderId = this.toPositiveInteger(rawId);
    if (!orderId) return { success: false, data: null, message: 'Orden de costo no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    const observation = this.toSearchString(payload?.observacion);
    if (!observation) {
      return { success: false, data: null, message: 'La observación final es obligatoria', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    if (observation.length > FINAL_OBSERVATION_MAX_LENGTH) {
      return { success: false, data: null, message: `La observación final no puede superar ${FINAL_OBSERVATION_MAX_LENGTH} caracteres`, errorCode: 'COST_ORDERS_VALIDATION' };
    }

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('add-obs')) {
      return { success: false, data: null, message: 'No tienes permiso para gestionar la observación final', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const result = await this.costOrdersRepository.addFinalObservation(orderId, userId, observation);
      if (result === 'not-found') return { success: false, data: null, message: 'Orden de costo no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'already-exists') return { success: false, data: null, message: 'Esta orden ya tiene una observación final', errorCode: 'COST_ORDERS_VALIDATION' };
      return { success: true, data: { id: orderId }, message: 'Observación final guardada correctamente' };
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

  async getBudgetLines(rawOrderId: unknown, rawTipo: unknown, rawPpto: unknown): Promise<CostOrderResponse<any[]>> {
    const orderId = this.toPositiveInteger(rawOrderId);
    const tipo = this.toPositiveInteger(rawTipo);
    const ppto = this.toPositiveInteger(rawPpto);
    if (!orderId || !tipo || !ppto || !BUDGET_STRUCTURES[tipo]) {
      return { success: false, data: null, message: 'Tipo de presupuesto y número son obligatorios', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    try {
      const order = await this.costOrdersRepository.findOrderById(orderId);
      if (!order) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (order.tipoPpto && Number(order.tipoPpto) !== tipo) {
        return { success: false, data: null, message: 'Esta orden fue creada para presupuestos de otro tipo', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      const rows = await this.costOrdersRepository.findBudgetLines(tipo, ppto);
      if (!rows.length) return { success: true, data: [], message: 'No hay información disponible' };

      const first = rows[0];
      const validation = this.validateBudgetForOrder(order, tipo, first);
      if (validation) return { success: false, data: null, message: validation, errorCode: 'COST_ORDERS_VALIDATION' };

      return {
        success: true,
        data: rows.map((row) => ({
          idPpto: Number(row.id),
          idDetallePpto: Number(row.idDetalle),
          detalle: row.detalle,
          total: Number(row.total ?? 0),
          valorAsignadoOc: Number(row.valorAsignadoOc ?? 0),
          ordenCosto: Number(row.ordenCosto ?? 0),
          disponible: this.round2(Number(row.disponible ?? 0)),
        })),
        message: null,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getBudgetLinesForCreate(query: CostOrderBudgetSearchQuery): Promise<CostOrderResponse<any[]>> {
    const idCliente = this.toPositiveInteger(query.idCliente);
    const idProveedor = this.toPositiveInteger(query.idProveedor);
    const tipo = this.toPositiveInteger(query.tipo);
    const ppto = this.toPositiveInteger(query.ppto);
    if (!idCliente || !idProveedor || !tipo || !ppto || !BUDGET_STRUCTURES[tipo]) {
      return { success: false, data: null, message: 'Cliente, proveedor, tipo de presupuesto y número son obligatorios', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    try {
      const rows = await this.costOrdersRepository.findBudgetLines(tipo, ppto);
      if (!rows.length) return { success: true, data: [], message: 'No hay información disponible' };

      const validation = this.validateBudgetForOrder({ idCliente, idProveedor }, tipo, rows[0]);
      if (validation) return { success: false, data: null, message: validation, errorCode: 'COST_ORDERS_VALIDATION' };

      return {
        success: true,
        data: rows.map((row) => ({
          idPpto: Number(row.id),
          idDetallePpto: Number(row.idDetalle),
          detalle: row.detalle,
          total: Number(row.total ?? 0),
          valorAsignadoOc: Number(row.valorAsignadoOc ?? 0),
          ordenCosto: Number(row.ordenCosto ?? 0),
          disponible: this.round2(Number(row.disponible ?? 0)),
        })),
        message: null,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getCompensateContext(roleId: number, query: CostOrderCompensateQuery): Promise<CostOrderResponse<CostOrderCompensateData>> {
    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('compensate')) {
      return { success: false, data: null, message: 'No tienes permiso para compensar costos', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    const orderId = this.toPositiveInteger(query.orderId);
    const tipo = this.toPositiveInteger(query.tipo);
    const ppto = this.toPositiveInteger(query.ppto);

    try {
      const order = orderId ? await this.costOrdersRepository.findOrderById(orderId) : null;
      if (orderId && !order) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

      const [budgetTypes, compensateRows] = await Promise.all([
        this.costOrdersRepository.findBudgetCategories(),
        orderId
          ? Promise.all([
            this.costOrdersRepository.findCompensateOrderDetails(orderId),
            this.costOrdersRepository.findCompensateAssociations(orderId),
          ])
          : Promise.resolve([[], []] as const),
      ]);
      const [orderDetails, associations] = compensateRows;
      const budgetTypeLabelById = new Map(budgetTypes.map((item) => [Number(item.id), item.label]));
      let budgetLines: any[] = [];
      if (tipo && ppto) {
        if (!BUDGET_STRUCTURES[tipo]) return { success: false, data: null, message: 'Tipo de presupuesto inválido', errorCode: 'COST_ORDERS_VALIDATION' };
        budgetLines = await this.costOrdersRepository.findBudgetLines(tipo, ppto);
        if (!budgetLines.length) return { success: false, data: null, message: 'Presupuesto no encontrado', errorCode: 'COST_ORDERS_VALIDATION' };
        if (order && budgetLines[0]) {
          const compensationTypeValidation = this.validateCompensationBudgetType(order, tipo);
          if (compensationTypeValidation) return { success: false, data: null, message: compensationTypeValidation, errorCode: 'COST_ORDERS_VALIDATION' };
          const validation = this.validateBudgetForOrder(order, tipo, budgetLines[0]);
          if (validation) return { success: false, data: null, message: validation, errorCode: 'COST_ORDERS_VALIDATION' };
        }
      }

      return {
        success: true,
        data: {
          order: order ? {
            id: Number(order.id),
            idEstado: order.idEstado === null || order.idEstado === undefined ? null : Number(order.idEstado),
            estado: order.estado ?? null,
            cliente: order.cliente ?? null,
            proveedor: order.proveedor ?? null,
            total: Number(order.total ?? 0),
            cobrado: Number(order.cobrado ?? 0),
            faltante: Number(order.faltante ?? 0),
          } : null,
          budget: tipo && ppto ? { tipo, ppto, estado: budgetLines[0]?.estado === undefined ? null : Number(budgetLines[0].estado) } : null,
          orderDetails: orderDetails.map((detail) => ({
            idDetalle: Number(detail.idDetalle),
            detalle: detail.detalle,
            total: Number(detail.total ?? 0),
            totalCobrado: Number(detail.totalCobrado ?? 0),
            faltante: this.round2(Number(detail.faltante ?? 0)),
          })),
          budgetLines: budgetLines.map((line) => ({
            idPpto: Number(line.id),
            idDetallePpto: Number(line.idDetalle),
            detalle: line.detalle,
            total: Number(line.total ?? 0),
            valorAsignadoOc: Number(line.valorAsignadoOc ?? 0),
            ordenCosto: Number(line.ordenCosto ?? 0),
            disponible: this.round2(Number(line.disponible ?? 0)),
          })),
          associations: associations.map((association) => ({
            associationId: association.associationId === null || association.associationId === undefined ? null : Number(association.associationId),
            idDetalleOrden: Number(association.idDetalleOrden),
            idDetallePpto: Number(association.idDetallePpto),
            idPpto: Number(association.idPpto),
            modulo: Number(association.modulo),
            tipoLabel: budgetTypeLabelById.get(Number(association.modulo)) ?? null,
            cobradoItem: this.round2(Number(association.cobradoItem ?? 0)),
            orderDetail: association.orderDetail ?? null,
            budgetDetail: association.budgetDetail ?? null,
          })),
          budgetTypes: budgetTypes.map((item) => ({ id: Number(item.id), label: item.label })),
        },
        message: null,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async suggestCompensation(roleId: number, payload: CostOrderCompensatePayload): Promise<CostOrderResponse<CostOrderCompensateSuggestion[]>> {
    const context = await this.getCompensateContext(roleId, { orderId: payload.orderId, tipo: payload.tipo, ppto: payload.ppto });
    if (!context.success) return { success: false, data: null, message: context.message, errorCode: 'COST_ORDERS_VALIDATION' };
    if (!context.data.order || !context.data.budget) {
      return { success: false, data: null, message: 'Orden y presupuesto son obligatorios para sugerir compensación', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    if (COMPENSATE_BLOCKED_STATES.includes(Number(context.data.order.idEstado) as 8 | 25 | 4)) {
      return { success: false, data: null, message: 'La orden no está disponible para compensar costos', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    const suggestions = this.buildCompensationSuggestions(context.data.orderDetails, context.data.budgetLines);
    return { success: true, data: suggestions, message: suggestions.length ? null : 'No se encontraron sugerencias con saldo disponible' };
  }

  async associateCompensation(userId: number, roleId: number, payload: CostOrderCompensatePayload): Promise<CostOrderResponse<{ id: number; associated: number }>> {
    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('compensate')) {
      return { success: false, data: null, message: 'No tienes permiso para compensar costos', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    const orderId = this.toPositiveInteger(payload.orderId);
    const tipo = this.toPositiveInteger(payload.tipo);
    const ppto = this.toPositiveInteger(payload.ppto);
    if (!orderId || !tipo || !ppto || !BUDGET_STRUCTURES[tipo]) {
      return { success: false, data: null, message: 'Orden, tipo y presupuesto son obligatorios', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    const associations = this.normalizeCompensationAssociations(payload.associations);
    if (!associations.length) {
      return { success: false, data: null, message: 'Selecciona al menos una asociación válida', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    try {
      const order = await this.costOrdersRepository.findOrderById(orderId);
      if (!order) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (COMPENSATE_BLOCKED_STATES.includes(Number(order.idEstado) as 8 | 25 | 4)) {
        return { success: false, data: null, message: 'La orden no está disponible para compensar costos', errorCode: 'COST_ORDERS_VALIDATION' };
      }

      const [orderDetails, budgetLines] = await Promise.all([
        this.costOrdersRepository.findCompensateOrderDetails(orderId),
        this.costOrdersRepository.findBudgetLines(tipo, ppto),
      ]);
      if (!budgetLines.length) return { success: false, data: null, message: 'Presupuesto no encontrado', errorCode: 'COST_ORDERS_VALIDATION' };
      const compensationTypeValidation = this.validateCompensationBudgetType(order, tipo);
      if (compensationTypeValidation) return { success: false, data: null, message: compensationTypeValidation, errorCode: 'COST_ORDERS_VALIDATION' };
      const validation = this.validateBudgetForOrder(order, tipo, budgetLines[0]);
      if (validation) return { success: false, data: null, message: validation, errorCode: 'COST_ORDERS_VALIDATION' };

      const orderById = new Map(orderDetails.map((detail) => [Number(detail.idDetalle), detail]));
      const budgetById = new Map(budgetLines.map((line) => [Number(line.idDetalle), line]));
      const orderTotals = new Map<number, { total: number; count: number }>();
      const budgetTotals = new Map<number, { total: number; count: number }>();
      for (const item of associations) {
        const detail = orderById.get(item.idDetalleOrden);
        const budget = budgetById.get(item.idDetallePpto);
        if (!detail) return { success: false, data: null, message: 'Un detalle de la orden no existe', errorCode: 'COST_ORDERS_VALIDATION' };
        if (!budget) return { success: false, data: null, message: 'Un detalle de presupuesto no existe', errorCode: 'COST_ORDERS_VALIDATION' };
        const orderCurrent = orderTotals.get(item.idDetalleOrden) ?? { total: 0, count: 0 };
        orderTotals.set(item.idDetalleOrden, { total: this.round2(orderCurrent.total + item.valor), count: orderCurrent.count + 1 });
        const budgetCurrent = budgetTotals.get(item.idDetallePpto) ?? { total: 0, count: 0 };
        budgetTotals.set(item.idDetallePpto, { total: this.round2(budgetCurrent.total + item.valor), count: budgetCurrent.count + 1 });
      }
      if (associations.length > 1 && orderTotals.size !== 1) {
        return { success: false, data: null, message: 'La asociación múltiple debe usar un solo detalle de orden', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      for (const [idDetalleOrden, entry] of orderTotals) {
        const detail = orderById.get(idDetalleOrden);
        if (associations.length > 1) continue;
        if (entry.total > this.round2(Number(detail?.faltante ?? 0))) return { success: false, data: null, message: 'El valor supera el faltante del detalle de orden', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      for (const [idDetallePpto, entry] of budgetTotals) {
        const budget = budgetById.get(idDetallePpto);
        if (entry.total > this.round2(Number(budget?.disponible ?? 0))) return { success: false, data: null, message: 'El valor supera el disponible del presupuesto', errorCode: 'COST_ORDERS_VALIDATION' };
      }

      const result = await this.costOrdersRepository.associateExistingBudgetDetails(orderId, userId, tipo, ppto, associations);
      if (result === 'order-unavailable') return { success: false, data: null, message: 'La orden ya no está disponible para compensar costos', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'internal-type-mismatch') return { success: false, data: null, message: 'Las órdenes internas solo se pueden compensar con presupuestos internos', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'external-type-mismatch') return { success: false, data: null, message: 'Las órdenes externas no se pueden compensar con presupuestos internos', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'budget-unavailable') return { success: false, data: null, message: 'El presupuesto ya no está disponible para esta orden', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'detail-unavailable') return { success: false, data: null, message: 'Un detalle de la orden ya no está disponible', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'unavailable') return { success: false, data: null, message: 'El valor solicitado supera el saldo disponible', errorCode: 'COST_ORDERS_VALIDATION' };

      return { success: true, data: { id: orderId, associated: result.associated }, message: 'Compensación guardada correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async reverseCompensationAssociation(userId: number, roleId: number, payload: CostOrderCompensateReversePayload): Promise<CostOrderResponse<{ id: number }>> {
    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('compensate')) {
      return { success: false, data: null, message: 'No tienes permiso para compensar costos', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    const orderId = this.toPositiveInteger(payload.orderId);
    const associationId = this.toPositiveInteger(payload.associationId);
    if (!orderId || !associationId) {
      return { success: false, data: null, message: 'Asociación no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    try {
      const result = await this.costOrdersRepository.reverseCompensateAssociation(orderId, associationId, userId);
      if (result === 'identifier-unavailable') return { success: false, data: null, message: 'La tabla de asociaciones no tiene un identificador único seguro para reversar un ítem individual', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'not-found') return { success: false, data: null, message: 'Asociación no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'order-unavailable') return { success: false, data: null, message: 'La orden no está disponible para reversar asociaciones', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'budget-unavailable') return { success: false, data: null, message: 'No se pudo liberar el detalle de presupuesto', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'detail-unavailable') return { success: false, data: null, message: 'No se pudo actualizar el detalle de la orden', errorCode: 'COST_ORDERS_VALIDATION' };

      return { success: true, data: { id: orderId }, message: 'Asociación reversada correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async attachBudgetLine(userId: number, roleId: number, rawOrderId: unknown, payload: CostOrderBudgetAttachPayload): Promise<CostOrderResponse<{ id: number; detail: { idDetalle: number; detalle: string; cantidad: number; valor: number; totalCobrado: number; faltante: number; hasBudget: boolean; budgetTipo: number; budgetPpto: number; budgetIdDetallePpto: number; budgetValorAsignado: number } }>> {
    const orderId = this.toPositiveInteger(rawOrderId);
    const tipo = this.toPositiveInteger(payload.tipo);
    const ppto = this.toPositiveInteger(payload.ppto);
    const idDetallePpto = this.toPositiveInteger(payload.idDetallePpto);
    const cantidad = this.toPositiveInteger(payload.cantidad);
    const valorAsignado = this.toNumber(payload.valorAsignado, NaN);

    if (!orderId || !tipo || !ppto || !idDetallePpto || !cantidad || !Number.isFinite(valorAsignado) || valorAsignado <= 0 || !BUDGET_STRUCTURES[tipo]) {
      return { success: false, data: null, message: 'El detalle de presupuesto es inválido', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('edit')) {
      return { success: false, data: null, message: 'No tienes permiso para editar órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const order = await this.costOrdersRepository.findOrderById(orderId);
      if (!order) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (Number(order.idEstado) !== COST_ORDER_STATUS.ACTIVE) {
        return { success: false, data: null, message: 'Solo se pueden editar órdenes en estado borrador (Activo)', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      if (order.tipoPpto && Number(order.tipoPpto) !== tipo) {
        return { success: false, data: null, message: 'Esta orden fue creada para presupuestos de otro tipo', errorCode: 'COST_ORDERS_VALIDATION' };
      }

      const rows = await this.costOrdersRepository.findBudgetLines(tipo, ppto);
      const budgetLine = rows.find((row) => Number(row.idDetalle) === idDetallePpto);
      if (!budgetLine) return { success: false, data: null, message: 'El detalle de presupuesto no existe', errorCode: 'COST_ORDERS_VALIDATION' };

      const validation = this.validateBudgetForOrder(order, tipo, budgetLine);
      if (validation) return { success: false, data: null, message: validation, errorCode: 'COST_ORDERS_VALIDATION' };

      const disponible = this.round2(Number(budgetLine.disponible ?? 0));
      if (disponible <= 0) {
        return { success: false, data: null, message: 'El detalle de presupuesto no tiene saldo disponible', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      if (this.round2(valorAsignado) > disponible) {
        return { success: false, data: null, message: 'El valor asignado supera el saldo disponible del presupuesto', errorCode: 'COST_ORDERS_VALIDATION' };
      }

      if (await this.costOrdersRepository.budgetLinkExists(orderId, ppto, idDetallePpto)) {
        return { success: false, data: null, message: 'Este item ya existe en la orden de costo', errorCode: 'COST_ORDERS_VALIDATION' };
      }

      const attachResult = await this.costOrdersRepository.attachBudgetLine(
        orderId,
        userId,
        tipo,
        ppto,
        idDetallePpto,
        budgetLine.detalle,
        cantidad,
        this.round2(valorAsignado),
        Number(order.idCliente),
        Number(order.idProveedor),
      );
      if (attachResult === 'order-unavailable') {
        return { success: false, data: null, message: 'La orden ya no está disponible para agregar presupuestos', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      if (attachResult === 'budget-unavailable') {
        return { success: false, data: null, message: 'El presupuesto ya no está disponible para esta orden', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      if (attachResult === 'duplicate') {
        return { success: false, data: null, message: 'Este item ya existe en la orden de costo', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      if (attachResult === 'unavailable') {
        return { success: false, data: null, message: 'El valor asignado supera el saldo disponible del presupuesto', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      return {
        success: true,
        data: {
          id: orderId,
          detail: {
            idDetalle: attachResult,
            detalle: budgetLine.detalle,
            cantidad,
            valor: this.round2(valorAsignado / cantidad),
            totalCobrado: this.round2(valorAsignado),
            faltante: 0,
            hasBudget: true,
            budgetTipo: tipo,
            budgetPpto: ppto,
            budgetIdDetallePpto: idDetallePpto,
            budgetValorAsignado: this.round2(valorAsignado),
          },
        },
        message: 'Detalle de presupuesto agregado correctamente',
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteDetail(userId: number, roleId: number, rawOrderId: unknown, rawDetailId: unknown): Promise<CostOrderResponse<{ id: number }>> {
    const orderId = this.toPositiveInteger(rawOrderId);
    const detailId = this.toPositiveInteger(rawDetailId);
    if (!orderId || !detailId) {
      return { success: false, data: null, message: 'Detalle de orden no encontrado', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('edit')) {
      return { success: false, data: null, message: 'No tienes permiso para editar órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const result = await this.costOrdersRepository.deleteDetail(orderId, detailId, userId);
      if (result === 'not-found') {
        return { success: false, data: null, message: 'Detalle de orden no encontrado', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      if (result === 'order-unavailable') {
        return { success: false, data: null, message: 'Solo se pueden editar órdenes en estado borrador (Activo)', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      if (result === 'budget-unavailable') {
        return { success: false, data: null, message: 'No se pudo liberar el detalle de presupuesto', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      return { success: true, data: { id: orderId }, message: 'Detalle eliminado correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
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
    const porcIva = this.toNumber(payload.porcIva, NaN);
    const porcDescuento = this.toNumber(payload.porcDescuento, 0);

    if (!idCliente || !idProveedor || !idProducto || !idCampana || !idServicio || !tipo) {
      return { success: false, data: null, message: 'Cliente, proveedor, producto, campaña, servicio y tipo son obligatorios', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    if (!Number.isFinite(porcIva) || porcIva < 0 || porcIva > 100 || porcDescuento < 0 || porcDescuento > 100) {
      return { success: false, data: null, message: 'IVA y descuento deben estar entre 0 y 100', errorCode: 'COST_ORDERS_VALIDATION' };
    }

    // 3) Detalle (opcional en la creación, pero si viene debe ser válido).
    const details = this.normalizeDetails(payload.detalles);
    if (details === null) {
      return { success: false, data: null, message: 'El detalle de la orden es inválido', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    const budgetDetails = this.normalizeBudgetDetails(payload.budgetDetails);
    if (budgetDetails === null) {
      return { success: false, data: null, message: 'El detalle de presupuesto es inválido', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    if (budgetDetails.some((item) => item.tipo !== budgetDetails[0]?.tipo)) {
      return { success: false, data: null, message: 'Esta orden fue creada para presupuestos de otro tipo', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    try {
      // Validar existencia de cliente/proveedor (evita FKs basura).
      const [clientOk, providerOk] = await Promise.all([
        this.costOrdersRepository.clientExists(idCliente, 'cliente'),
        this.costOrdersRepository.clientExists(idProveedor, 'proveedor'),
      ]);
      if (!clientOk) return { success: false, data: null, message: 'El cliente seleccionado no existe o está inactivo', errorCode: 'COST_ORDERS_VALIDATION' };
      if (!providerOk) return { success: false, data: null, message: 'El proveedor seleccionado no existe o está inactivo', errorCode: 'COST_ORDERS_VALIDATION' };

      const budgetDetailsForCreate: { tipo: number; ppto: number; idDetallePpto: number; detalle: string; cantidad: number; valorAsignado: number }[] = [];
      const requestedByBudgetDetail = new Map<string, number>();
      for (const item of budgetDetails) {
        const rows = await this.costOrdersRepository.findBudgetLines(item.tipo, item.ppto);
        const budgetLine = rows.find((row) => Number(row.idDetalle) === item.idDetallePpto);
        if (!budgetLine) return { success: false, data: null, message: 'El detalle de presupuesto no existe', errorCode: 'COST_ORDERS_VALIDATION' };

        const validation = this.validateBudgetForOrder({ idCliente, idProveedor }, item.tipo, budgetLine);
        if (validation) return { success: false, data: null, message: validation, errorCode: 'COST_ORDERS_VALIDATION' };

        const key = `${item.tipo}:${item.ppto}:${item.idDetallePpto}`;
        const requested = this.round2((requestedByBudgetDetail.get(key) ?? 0) + item.valorAsignado);
        requestedByBudgetDetail.set(key, requested);
        const disponible = this.round2(Number(budgetLine.disponible ?? 0));
        if (disponible <= 0) return { success: false, data: null, message: 'El detalle de presupuesto no tiene saldo disponible', errorCode: 'COST_ORDERS_VALIDATION' };
        if (requested > disponible) return { success: false, data: null, message: 'El valor asignado supera el saldo disponible del presupuesto', errorCode: 'COST_ORDERS_VALIDATION' };

        budgetDetailsForCreate.push({ ...item, detalle: budgetLine.detalle });
      }

      // 4) Cálculo de totales (misma fórmula del legacy ValorTotal).
      const valor = details.reduce((sum, d) => sum + d.total, 0) + budgetDetailsForCreate.reduce((sum, d) => sum + d.valorAsignado, 0);
      const descuento = valor * (porcDescuento / 100);
      const iva = (valor - descuento) * (porcIva / 100);
      const total = valor - descuento + iva;

      const id = await this.costOrdersRepository.createOrder(
        {
          fecha: new Date().toISOString().slice(0, 10),
          idCliente, idProveedor, idProducto, idCampana, idServicio,
          idEstado: COST_ORDER_STATUS.ACTIVE, // ACTIVO (borrador), como el legacy
          idUsuario: userId,
          tipo,
          observacion: observacion || null,
          porcIva, porcDescuento,
          valor: this.round2(valor),
          total: this.round2(total),
        },
        details,
        budgetDetailsForCreate,
      );
      if (id === 'budget-unavailable') return { success: false, data: null, message: 'El presupuesto ya no está disponible para esta orden', errorCode: 'COST_ORDERS_VALIDATION' };
      if (id === 'budget-type-mismatch') return { success: false, data: null, message: 'Esta orden fue creada para presupuestos de otro tipo', errorCode: 'COST_ORDERS_VALIDATION' };
      if (id === 'unavailable') return { success: false, data: null, message: 'El valor asignado supera el saldo disponible del presupuesto', errorCode: 'COST_ORDERS_VALIDATION' };

      return { success: true, data: { id }, message: 'Orden de costo creada correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  // --- Edición ---

  async getOrderForEdit(id: number, roleId: number): Promise<CostOrderResponse<CostOrderDetailData>> {
    const orderId = this.toPositiveInteger(id);
    if (!orderId) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    try {
      const [header, roleActions] = await Promise.all([
        this.costOrdersRepository.findOrderById(orderId),
        this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE),
      ]);
      if (!header) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

      const details = await this.costOrdersRepository.findOrderDetails(orderId);
      return { success: true, data: this.normalizeOrderDetail(header, details, roleActions), message: null };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPrintData(rawId: unknown, roleId: number): Promise<CostOrderResponse<CostOrderPrintData>> {
    const orderId = this.toPositiveInteger(rawId);
    if (!orderId) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('print')) {
      return { success: false, data: null, message: 'No tienes permiso para imprimir órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const [header, details, budgets, billing] = await Promise.all([
        this.costOrdersRepository.findPrintHeader(orderId),
        this.costOrdersRepository.findOrderDetails(orderId),
        this.costOrdersRepository.findPrintBudgets(orderId),
        this.costOrdersRepository.findPrintBilling(),
      ]);
      if (!header) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

      const valor = this.round2(Number(header.valor ?? 0));
      const porcDescuento = Number(header.porcDescuento ?? 0);
      const porcIva = Number(header.porcIva ?? 0);
      const descuento = this.round2(valor * (porcDescuento / 100));
      const subtotal = this.round2(valor - descuento);
      const total = this.round2(Number(header.total ?? subtotal + subtotal * (porcIva / 100)));
      const iva = this.round2(total - subtotal);
      const numImpresiones = Number(header.numImpresiones ?? -1);
      const nit = this.withDv(billing?.nit ?? null, billing?.dv ?? null);

      return {
        success: true,
        data: {
          company: {
            name: billing?.razonSocial || billing?.nombreComercial || FALLBACK_COMPANY.name,
            commercialName: billing?.nombreComercial || FALLBACK_COMPANY.commercialName,
            nit: nit || FALLBACK_COMPANY.nit,
            address: billing?.direccion || FALLBACK_COMPANY.address,
            city: billing?.ciudad || FALLBACK_COMPANY.city,
            department: billing?.departamento || FALLBACK_COMPANY.department,
            country: billing?.pais || FALLBACK_COMPANY.country,
            phone: billing?.telefono || FALLBACK_COMPANY.phone,
          },
          order: {
            id: Number(header.id),
            fecha: this.toIsoDate(header.fecha),
            estado: header.estado ?? null,
            tipo: header.tipo === 'I' ? 'INTERNA' : header.tipo ? 'EXTERNA' : null,
            copyLabel: numImpresiones < 0 ? 'ORIGINAL' : 'DUPLICADO',
            numImpresiones,
            observacion: header.observacion ?? null,
            finalObservation: header.finalObservation ?? null,
          },
          client: {
            name: header.cliente ?? null,
            nit: header.clienteDocumento ?? null,
            address: header.clienteDireccion ?? null,
            phone: header.clienteTelefono ?? null,
            city: header.clienteCiudad ?? null,
          },
          provider: {
            name: header.proveedor ?? null,
            nit: header.proveedorDocumento ?? null,
            address: header.proveedorDireccion ?? null,
            phone: header.proveedorTelefono ?? null,
            city: header.proveedorCiudad ?? null,
          },
          campaign: header.campana ?? null,
          product: header.producto ?? null,
          service: header.servicio ?? null,
          budgets: budgets.map((budget) => ({ ppto: Number(budget.ppto), tipo: budget.tipo === null ? null : Number(budget.tipo) })),
          details: details.map((detail) => ({
            idDetalle: Number(detail.idDetalle),
            detalle: detail.detalle,
            cantidad: Number(detail.cantidad ?? 0),
            valor: Number(detail.valor ?? 0),
            total: Number(detail.total ?? 0),
          })),
          totals: { valor, descuento, subtotal, iva, total, porcDescuento, porcIva },
          creator: { name: header.creador ?? null, email: header.creadorEmail ?? null },
        },
        message: null,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async printOrder(userId: number, roleId: number, rawId: unknown): Promise<CostOrderResponse<CostOrderPrintMutationData>> {
    const orderId = this.toPositiveInteger(rawId);
    if (!orderId) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('print')) {
      return { success: false, data: null, message: 'No tienes permiso para imprimir órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const result = await this.costOrdersRepository.markPrinted(orderId, userId);
      if (result === 'not-found') return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      return {
        success: true,
        data: {
          id: orderId,
          idEstado: result.idEstado,
          numImpresiones: result.numImpresiones,
          copyLabel: result.numImpresiones < 0 ? 'ORIGINAL' : 'DUPLICADO',
        },
        message: 'Orden marcada como impresa',
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async finalizeOrder(userId: number, roleId: number, rawOrderId: unknown): Promise<CostOrderResponse<{ id: number }>> {
    const orderId = this.toPositiveInteger(rawOrderId);
    if (!orderId) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('finish')) {
      return { success: false, data: null, message: 'No tienes permiso para finalizar órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const result = await this.costOrdersRepository.finalizeOrder(orderId, userId);
      if (result === 'not-found') return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'already-finalized') return { success: false, data: null, message: 'La orden ya esta finalizada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'no-value') return { success: false, data: null, message: 'La orden no tiene valor', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'negative-balance') return { success: false, data: null, message: 'Esta orden tiene saldo negativo', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'pending-balance') return { success: false, data: null, message: 'La orden aún no esta cobrada en su totalidad', errorCode: 'COST_ORDERS_VALIDATION' };
      return { success: true, data: { id: orderId }, message: 'Orden finalizada correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async anuleOrder(userId: number, roleId: number, rawOrderId: unknown): Promise<CostOrderResponse<{ id: number }>> {
    const orderId = this.toPositiveInteger(rawOrderId);
    if (!orderId) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('anule')) {
      return { success: false, data: null, message: 'No tienes permiso para anular órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const result = await this.costOrdersRepository.anuleOrder(orderId, userId);
      if (result === 'not-found') return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'invalid-state') return { success: false, data: null, message: 'Solo se pueden anular órdenes activas o impresas', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'has-budget-links') return { success: false, data: null, message: 'No se puede anular una orden con presupuestos asociados', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'has-radicado') return { success: false, data: null, message: 'Esta orden fue enviada por el proveedor y no se puede anular', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'sequence-not-found') return { success: false, data: null, message: 'No está configurado el consecutivo de anulación de órdenes de costo', errorCode: 'COST_ORDERS_VALIDATION' };
      return { success: true, data: { id: orderId }, message: 'Orden anulada correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async replaceOrder(userId: number, roleId: number, rawOrderId: unknown): Promise<CostOrderResponse<{ id: number }>> {
    const orderId = this.toPositiveInteger(rawOrderId);
    if (!orderId) return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };

    const roleActions = await this.permissionsService.getRoleModuleActions(roleId, COST_ORDERS_MODULE);
    if (!roleActions.has('replace')) {
      return { success: false, data: null, message: 'No tienes permiso para reemplazar órdenes de costo', errorCode: 'COST_ORDERS_FORBIDDEN' };
    }

    try {
      const result = await this.costOrdersRepository.replaceOrder(orderId, userId);
      if (result === 'not-found') return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'invalid-state') return { success: false, data: null, message: 'Solo se pueden reemplazar órdenes finalizadas o impresas', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'has-radicado') return { success: false, data: null, message: 'Esta orden fue enviada por el proveedor y no se puede reemplazar', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'no-budget-links') return { success: false, data: null, message: 'Esta Orden no tiene ningun cobro asignado, para reemplazar debes anular y duplicar', errorCode: 'COST_ORDERS_VALIDATION' };
      if (result === 'invalid-budget-links') return { success: false, data: null, message: 'La orden tiene cobros asociados a detalles inválidos y no se puede reemplazar', errorCode: 'COST_ORDERS_VALIDATION' };
      return { success: true, data: result, message: `Orden reemplazada correctamente. Nueva orden: ${result.id}` };
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
    const porcIva = this.toNumber(payload.porcIva, NaN);
    const porcDescuento = this.toNumber(payload.porcDescuento, 0);

    if (!idCliente || !idProveedor || !idProducto || !idCampana || !idServicio) {
      return { success: false, data: null, message: 'Cliente, proveedor, producto, campaña y servicio son obligatorios', errorCode: 'COST_ORDERS_VALIDATION' };
    }
    if (!Number.isFinite(porcIva) || porcIva < 0 || porcIva > 100 || porcDescuento < 0 || porcDescuento > 100) {
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
      if (Number(current.idEstado) !== COST_ORDER_STATUS.ACTIVE) {
        return { success: false, data: null, message: 'Solo se pueden editar órdenes en estado borrador (Activo)', errorCode: 'COST_ORDERS_VALIDATION' };
      }

      const [clientOk, providerOk] = await Promise.all([
        this.costOrdersRepository.clientExists(idCliente, 'cliente'),
        this.costOrdersRepository.clientExists(idProveedor, 'proveedor'),
      ]);
      if (!clientOk) return { success: false, data: null, message: 'El cliente seleccionado no existe o está inactivo', errorCode: 'COST_ORDERS_VALIDATION' };
      if (!providerOk) return { success: false, data: null, message: 'El proveedor seleccionado no existe o está inactivo', errorCode: 'COST_ORDERS_VALIDATION' };

      const updateResult = await this.costOrdersRepository.updateOrder(
        id,
        {
          idCliente, idProveedor, idProducto, idCampana, idServicio,
          observacion: observacion || null, porcIva, porcDescuento,
          idUsuario: userId,
        },
        details,
        true,
      );
      if (updateResult === 'not-found') return { success: false, data: null, message: 'Orden no encontrada', errorCode: 'COST_ORDERS_VALIDATION' };
      if (updateResult === 'order-unavailable') {
        return { success: false, data: null, message: 'Solo se pueden editar órdenes en estado borrador (Activo)', errorCode: 'COST_ORDERS_VALIDATION' };
      }
      if (updateResult === 'owner-change-blocked') {
        return {
          success: false,
          data: null,
          message: 'No puedes cambiar cliente o proveedor porque la orden tiene presupuestos asociados',
          errorCode: 'COST_ORDERS_VALIDATION',
        };
      }

      return { success: true, data: { id }, message: 'Orden de costo actualizada correctamente' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private normalizeOrderDetail(header: CostOrderHeaderRow, details: CostOrderDetailRow[], roleActions: Set<string>): CostOrderDetailData {
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return {
      id: Number(header.id),
      idEstado: num(header.idEstado),
      estado: header.estado ?? null,
      editable: Number(header.idEstado) === COST_ORDER_STATUS.ACTIVE,
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
      porcIva: header.porcIva === null || header.porcIva === undefined ? null : Number(header.porcIva),
      porcDescuento: Number(header.porcDescuento ?? 0),
      valor: Number(header.valor ?? 0),
      total: Number(header.total ?? 0),
      cobrado: Number(header.cobrado ?? 0),
      faltante: this.round2(Number(header.faltante ?? 0)),
      detalles: details.map((d) => ({
        idDetalle: Number(d.idDetalle),
        detalle: d.detalle,
        cantidad: Number(d.cantidad),
        valor: Number(d.valor),
        total: Number(d.total),
        totalCobrado: Number(d.totalCobrado ?? 0),
        faltante: this.round2(Number(d.faltante ?? 0)),
        hasBudget: Number(d.hasBudget) === 1,
        budgetTipo: num(d.budgetTipo),
        budgetPpto: num(d.budgetPpto),
        budgetIdDetallePpto: num(d.budgetIdDetallePpto),
        budgetValorAsignado: num(d.budgetValorAsignado),
      })),
      permittedActions: this.resolvePermittedActions(roleActions, num(header.idEstado)),
    };
  }

  private normalizeCompensationAssociations(value: unknown): { idDetalleOrden: number; idDetallePpto: number; valor: number }[] {
    if (!Array.isArray(value)) return [];
    const result: { idDetalleOrden: number; idDetallePpto: number; valor: number }[] = [];
    for (const raw of value) {
      if (typeof raw !== 'object' || raw === null) return [];
      const item = raw as Record<string, unknown>;
      const idDetalleOrden = this.toPositiveInteger(item.idDetalleOrden);
      const idDetallePpto = this.toPositiveInteger(item.idDetallePpto);
      const valor = this.toNumber(item.valor, NaN);
      if (!idDetalleOrden || !idDetallePpto || !Number.isFinite(valor) || valor <= 0) return [];
      result.push({ idDetalleOrden, idDetallePpto, valor: this.round2(valor) });
    }
    return result;
  }

  private buildCompensationSuggestions(
    orderDetails: { idDetalle: number; detalle: string; faltante: number }[],
    budgetLines: { idDetallePpto: number; detalle: string; disponible: number }[],
  ): CostOrderCompensateSuggestion[] {
    const candidates: CostOrderCompensateSuggestion[] = [];
    for (const orderDetail of orderDetails) {
      const missing = this.round2(Number(orderDetail.faltante ?? 0));
      if (missing <= 0) continue;
      const orderText = this.normalizeText(orderDetail.detalle);
      for (const budgetLine of budgetLines) {
        const available = this.round2(Number(budgetLine.disponible ?? 0));
        if (available <= 0) continue;
        const budgetText = this.normalizeText(budgetLine.detalle);
        const textScore = this.textSimilarity(orderText, budgetText);
        const exactText = this.normalizeComparableText(orderDetail.detalle) === this.normalizeComparableText(budgetLine.detalle);
        const exactValue = missing === available;
        let score = 0;
        let confidence: 'Alta' | 'Media' | 'Baja' = 'Baja';
        let reason = '';

        if (exactText && orderText.length > 0) {
          score = 1;
          confidence = 'Alta';
          reason = 'Detalle exacto';
        } else if (exactValue) {
          score = 0.9;
          confidence = 'Alta';
          reason = 'Valor exacto';
        } else if (textScore >= 0.65) {
          score = this.round2(textScore);
          confidence = textScore >= 0.8 ? 'Alta' : 'Media';
          reason = `Coincidencia fuerte de texto ${Math.round(textScore * 100)}%`;
        } else {
          continue;
        }

        candidates.push({
          idDetalleOrden: Number(orderDetail.idDetalle),
          idDetallePpto: Number(budgetLine.idDetallePpto),
          orderDetail: orderDetail.detalle,
          budgetDetail: budgetLine.detalle,
          suggestedValue: this.round2(Math.min(missing, available)),
          confidence,
          score,
          reason,
          conflict: false,
          includeInBulk: false,
        });
      }
    }

    const bestByOrder = new Map<number, CostOrderCompensateSuggestion>();
    for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
      if (!bestByOrder.has(candidate.idDetalleOrden)) bestByOrder.set(candidate.idDetalleOrden, candidate);
    }
    const selected = [...bestByOrder.values()].sort((a, b) => b.score - a.score);
    const budgetUseCount = new Map<number, number>();
    for (const suggestion of selected) budgetUseCount.set(suggestion.idDetallePpto, (budgetUseCount.get(suggestion.idDetallePpto) || 0) + 1);
    for (const suggestion of selected) {
      suggestion.conflict = (budgetUseCount.get(suggestion.idDetallePpto) || 0) > 1;
      suggestion.includeInBulk = !suggestion.conflict && suggestion.confidence !== 'Baja';
      if (suggestion.conflict) suggestion.reason += ' · conflicto: otro detalle sugiere el mismo presupuesto';
    }
    return selected;
  }

  private normalizeText(value: string): string[] {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  private normalizeComparableText(value: string): string {
    return this.normalizeText(value).join(' ');
  }

  private textSimilarity(a: string[], b: string[]): number {
    if (!a.length || !b.length) return 0;
    const left = new Set(a);
    const right = new Set(b);
    let intersection = 0;
    for (const token of left) if (right.has(token)) intersection += 1;
    return intersection / Math.max(left.size, right.size);
  }

  private validateBudgetForOrder(order: Pick<CostOrderHeaderRow, 'idCliente' | 'idProveedor'>, tipo: number, budget: { idCliente: unknown; idProveedor: unknown; estado: unknown }): string | null {
    if (Number(order.idCliente) !== Number(budget.idCliente)) return 'El presupuesto pertenece a otro cliente';
    if (tipo !== 7 && Number(order.idProveedor) !== Number(budget.idProveedor)) return 'El presupuesto pertenece a otro proveedor';
    const estado = Number(budget.estado);
    if (estado === BUDGET_STATUS.CANCELED) return 'El presupuesto esta Anulado';
    if (estado === BUDGET_STATUS.CREDIT_NOTE) return 'El presupuesto no esta disponible dado que tiene nota crédito';
    return null;
  }

  private validateCompensationBudgetType(order: CostOrderHeaderRow, tipo: number): string | null {
    const rawTipoPpto = order.tipoPpto;
    if (rawTipoPpto === null || rawTipoPpto === undefined || rawTipoPpto === '') return null;
    const tipoPpto = Number(rawTipoPpto);
    if (!Number.isFinite(tipoPpto)) return null;
    if (tipoPpto === 7 && tipo !== 7) return 'Las órdenes internas solo se pueden compensar con presupuestos internos';
    if (tipoPpto !== 7 && tipo === 7) return 'Las órdenes externas no se pueden compensar con presupuestos internos';
    return null;
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

  private normalizeBudgetDetails(value: unknown): { tipo: number; ppto: number; idDetallePpto: number; cantidad: number; valorAsignado: number }[] | null {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) return null;

    const result: { tipo: number; ppto: number; idDetallePpto: number; cantidad: number; valorAsignado: number }[] = [];
    for (const raw of value) {
      if (typeof raw !== 'object' || raw === null) return null;
      const item = raw as Record<string, unknown>;
      const tipo = this.toPositiveInteger(item.tipo);
      const ppto = this.toPositiveInteger(item.ppto);
      const idDetallePpto = this.toPositiveInteger(item.idDetallePpto);
      const cantidad = this.toPositiveInteger(item.cantidad);
      const valorAsignado = this.toNumber(item.valorAsignado, NaN);
      if (!tipo || !ppto || !idDetallePpto || !cantidad || !Number.isFinite(valorAsignado) || valorAsignado <= 0 || !BUDGET_STRUCTURES[tipo]) return null;
      result.push({ tipo, ppto, idDetallePpto, cantidad, valorAsignado: this.round2(valorAsignado) });
    }
    return result;
  }

  private normalizeIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const ids = new Set<number>();
    for (const item of value) {
      const id = this.toPositiveInteger(item);
      if (!id) return [];
      ids.add(id);
    }
    return [...ids].sort((a, b) => a - b);
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
      hasFinalObservation: Number(row.hasFinalObservation ?? 0) === 1,
      hasBudgetLinks: Number(row.hasBudgetLinks ?? 0) === 1,
      permittedActions: this.resolvePermittedActions(roleActions, idEstado, Number(row.hasBudgetLinks ?? 0) === 1),
    };
  }

  private toIsoDate(value: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }

  private withDv(nit: string | null, dv: string | null): string | null {
    const base = nit?.trim();
    if (!base) return null;
    const digit = dv?.trim();
    return digit ? `${base}-${digit}` : base;
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
