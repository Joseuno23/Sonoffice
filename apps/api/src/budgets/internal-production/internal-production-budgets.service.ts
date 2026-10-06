import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, stat, writeFile } from 'fs/promises';
import { basename, resolve } from 'path';
import internalProductionBudgetConfig from '../../config/internal-production-budget.config';
import { FinancialTaxDefaults } from '../../financial-parameters/financial-tax-parameters.types';
import { FinancialTaxParametersService } from '../../financial-parameters/financial-tax-parameters.service';
import { PermissionsService } from '../../permissions/permissions.service';
import { INTERNAL_PRODUCTION_SUPPORT_DIR } from '../../uploads-path';
import { InternalProductionBudgetsRepository } from './internal-production-budgets.repository';
import { ApiResponse, BudgetPayload, CostOrderDetailPayload, DetailPayload, ListQuery } from './internal-production-budgets.types';

const PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
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

const LEGACY_INTERNAL_MODULE = 7;
const LEGACY_CANCELLED_STATUS = 9999;
const INTERNAL_PRODUCTION_BUDGETS_MODULE = 'internal-production-budgets';
const INTERNAL_PRODUCTION_BUDGETS_MENU_CODES = ['media.budgets.produccion-interna.list', 'media.budgets.produccion-interna'];
const SUPPORT_MAX_SIZE = 10 * 1024 * 1024;

@Injectable()
export class InternalProductionBudgetsService {
  constructor(
    private readonly repository: InternalProductionBudgetsRepository,
    private readonly taxParameters: FinancialTaxParametersService,
    private readonly permissionsService: PermissionsService,
    @Inject(internalProductionBudgetConfig.KEY)
    private readonly config: ConfigType<typeof internalProductionBudgetConfig>,
  ) {}

  async list(query: ListQuery, roleId = 0): Promise<ApiResponse<any>> {
    const forbidden = await this.requireModuleAccess(roleId);
    if (forbidden) return forbidden;
    try {
      const page = this.toPositive(query.page) ?? 1;
      const pageSize = Math.min(this.toPositive(query.pageSize) ?? PAGE_SIZE, MAX_PAGE_SIZE);
      const [{ rows, total }, roleActions] = await Promise.all([
        this.repository.list({ search: this.text(query.search), estado: this.toPositive(query.estado) }, pageSize, (page - 1) * pageSize),
        this.permissionsService.getRoleModuleActions(roleId, INTERNAL_PRODUCTION_BUDGETS_MODULE),
      ]);
      const items = rows.map((row) => {
        const actions = this.resolveListActions(row, roleActions);
        return { ...row, fecha: this.date(row.fecha), editable: Number(row.idEstado) === this.config.statuses.active, incentivoXServicio: Number(row.incentivoXServicio ?? 0) === 1, actions, permittedActions: actions };
      });
      return { success: true, data: { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), moduleCode: INTERNAL_PRODUCTION_BUDGETS_MODULE, moduleActions: [...roleActions] }, message: null };
    } catch (error) { return this.error(error); }
  }

  async statuses(): Promise<ApiResponse<any>> {
    try { return { success: true, data: await this.repository.statuses(), message: null }; }
    catch (error) { return this.error(error); }
  }

  async defaults(_idCliente?: unknown, _idServicio?: unknown): Promise<ApiResponse<any>> {
    const defaults = await this.financialTaxDefaults();
    return { success: true, data: { iva: defaults.iva, spa: 0, ivaSpa: 0, editableIncentiveCostServiceIds: [] }, message: null };
  }

  async options(type: string, value?: unknown): Promise<ApiResponse<any>> {
    try {
      if (!['clients', 'providers', 'services', 'campaigns', 'products', 'departments', 'cities', 'contracts'].includes(type)) return this.fail('Catálogo inválido');
      if ((type === 'campaigns' || type === 'products' || type === 'contracts') && !this.toPositive(value)) return { success: true, data: [], message: null };
      if (type === 'cities' && !this.text(value)) return { success: true, data: [], message: null };
      return { success: true, data: await this.repository.options(type as any, type === 'campaigns' || type === 'products' || type === 'contracts' ? this.toPositive(value) : this.text(value)), message: null };
    } catch (error) { return this.error(error); }
  }

  async get(rawId: unknown, roleId = 0): Promise<ApiResponse<any>> {
    const forbidden = await this.requireModuleAccess(roleId);
    if (forbidden) return forbidden;
    const id = this.toPositive(rawId);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const data = await this.repository.get(id);
      if (!data.header) return this.fail('Presupuesto no encontrado');
      return { success: true, data: { ...data.header, fecha: this.date(data.header.fecha), editable: Number(data.header.idEstado) === this.config.statuses.active, incentivoXServicio: false, details: data.details.map((row) => ({ ...row, incentivo: 0, valor: Number(row.valor ?? 0), editableCost: false })), orders: [] }, message: null };
    } catch (error) { return this.error(error); }
  }

  async incentives(_query: any): Promise<ApiResponse<any>> {
    return { success: true, data: [], message: null };
  }

  async support(idRaw: unknown, roleId: number): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'support', 'No tienes permiso para gestionar soportes de presupuesto');
    if (forbidden) return forbidden;
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const budget = await this.repository.supportBudget(id);
      if (!budget) return this.fail('Presupuesto no encontrado');
      const attachments = await this.repository.supportAttachments(id);
      return {
        success: true,
        data: {
          budget: { id: budget.id, idEstado: budget.idEstado, estado: budget.estado, canUpload: Number(budget.idEstado ?? 0) !== LEGACY_CANCELLED_STATUS },
          attachments: attachments.map((row) => ({ ...row, fecha: this.date(row.fecha), modulo: LEGACY_INTERNAL_MODULE, downloadUrl: `/api/budgets/internal-production/${id}/support/${encodeURIComponent(row.nombre || '')}` })),
        },
        message: null,
      };
    }
    catch (error) { return this.error(error); }
  }

  async uploadSupport(idRaw: unknown, roleId: number, file?: { originalname?: string; size?: number; buffer?: Buffer }): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'support', 'No tienes permiso para gestionar soportes de presupuesto');
    if (forbidden) return forbidden;
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    if (!file?.buffer || !file.originalname) return this.fail('Debe seleccionar un archivo de soporte');
    if (Number(file.size ?? 0) > SUPPORT_MAX_SIZE) return this.fail('El archivo no debe superar 10 MB');
    try {
      const budget = await this.repository.supportBudget(id);
      if (!budget) return this.fail('Presupuesto no encontrado');
      if (Number(budget.idEstado ?? 0) === LEGACY_CANCELLED_STATUS) return this.fail('No se pueden cargar soportes a un presupuesto anulado');
      const filename = this.safeSupportFilename(file.originalname);
      if (!filename) return this.fail('Nombre de archivo inválido');
      const directory = this.supportDirectory(id);
      await mkdir(directory, { recursive: true });
      const fullPath = resolve(directory, filename);
      if (!fullPath.startsWith(directory + '/')) return this.fail('Nombre de archivo inválido');
      await writeFile(fullPath, file.buffer);
      await this.repository.addSupportAttachment(id, filename);
      return { success: true, data: { filename }, message: 'Soporte cargado correctamente' };
    } catch (error) { return this.error(error); }
  }

  async downloadSupport(idRaw: unknown, rawFilename: unknown, roleId: number): Promise<{ ok: true; path: string; filename: string } | { ok: false; message: string }> {
    if (!(await this.hasModuleAccess(roleId)) || !(await this.hasAction(roleId, 'support'))) return { ok: false, message: 'No tienes permiso para gestionar soportes de presupuesto' };
    const id = this.toPositive(idRaw);
    const filename = typeof rawFilename === 'string' ? this.safeSupportFilename(rawFilename) : null;
    if (!id || !filename) return { ok: false, message: 'Soporte no encontrado' };
    const row = await this.repository.supportAttachment(id, filename);
    if (!row) return { ok: false, message: 'Soporte no encontrado' };
    const directory = this.supportDirectory(id);
    const fullPath = resolve(directory, filename);
    if (!fullPath.startsWith(directory + '/')) return { ok: false, message: 'Soporte no encontrado' };
    try { const info = await stat(fullPath); if (!info.isFile()) return { ok: false, message: 'Soporte no encontrado' }; }
    catch { return { ok: false, message: 'Soporte no encontrado' }; }
    return { ok: true, path: fullPath, filename };
  }

  async create(userId: number, roleId: number, payload: BudgetPayload): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'create', 'No tienes permiso para crear presupuestos de producción interna');
    if (forbidden) return forbidden;
    try {
      const normalized = this.normalizeHeader(payload, await this.financialTaxDefaults());
      if (typeof normalized === 'string') return this.fail(normalized);
      const id = await this.repository.create(userId, normalized);
      if (id === 'sequence-not-found') return this.fail('No existe consecutivo configurado para presupuesto');
      return { success: true, data: { id }, message: `Presupuesto #${id} creado correctamente` };
    } catch (error) { return this.error(error); }
  }

  async update(idRaw: unknown, userId: number, roleId: number, payload: BudgetPayload): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'edit', 'No tienes permiso para editar presupuestos de producción interna');
    if (forbidden) return forbidden;
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const savedTaxValues = await this.repository.headerTaxValues(id);
      if (!savedTaxValues) return this.fail('Presupuesto no encontrado');
      const normalized = this.normalizeHeader(payload, savedTaxValues);
      if (typeof normalized === 'string') return this.fail(normalized);
      const result = await this.repository.update(id, userId, normalized);
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'not-active') return this.fail('El presupuesto debe estar activo para ser modificado');
      return { success: true, data: { id }, message: 'Presupuesto actualizado correctamente' };
    } catch (error) { return this.error(error); }
  }

  async saveDetail(idRaw: unknown, detailRaw: unknown, roleId: number, payload: DetailPayload): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'edit', 'No tienes permiso para editar presupuestos de producción interna');
    if (forbidden) return forbidden;
    const budgetId = this.toPositive(idRaw);
    const detailId = this.toPositive(detailRaw);
    if (!budgetId) return this.fail('Presupuesto no encontrado');
    try {
      const normalized = this.normalizeDetail(payload, (await this.financialTaxDefaults()).iva);
      if (typeof normalized === 'string') return this.fail(normalized);
      const result = await this.repository.saveDetail(budgetId, detailId ?? null, normalized);
      if (result === 'not-found') return this.fail('Presupuesto o detalle no encontrado');
      if (result === 'not-active') return this.fail('El presupuesto debe estar activo para ser modificado');
      return { success: true, data: { id: budgetId }, message: detailId ? 'Detalle actualizado correctamente' : 'Detalle agregado correctamente' };
    } catch (error) { return this.error(error); }
  }

  async deleteDetail(idRaw: unknown, detailRaw: unknown, userId: number, roleId: number): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'edit', 'No tienes permiso para editar presupuestos de producción interna');
    if (forbidden) return forbidden;
    const budgetId = this.toPositive(idRaw);
    const detailId = this.toPositive(detailRaw);
    if (!budgetId || !detailId) return this.fail('Detalle no encontrado');
    try {
      const result = await this.repository.deleteDetail(budgetId, detailId, userId);
      if (result === 'not-found') return this.fail('Detalle no encontrado');
      if (result === 'not-active') return this.fail('El presupuesto debe estar activo para ser modificado');
      if (result === 'cost-order-link-unavailable') return this.fail('No se puede eliminar: las asociaciones con órdenes de costo están incompletas y requieren revisión manual');
      return { success: true, data: { id: budgetId }, message: 'Detalle eliminado correctamente' };
    } catch (error) { return this.error(error); }
  }

  async costOrderDetails(idRaw: unknown, orderRaw: unknown, roleId: number): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'edit', 'No tienes permiso para editar presupuestos de producción interna');
    if (forbidden) return forbidden;
    const budgetId = this.toPositive(idRaw);
    const orderId = this.toPositive(orderRaw);
    if (!budgetId || !orderId) return this.fail('Presupuesto y orden de costo son obligatorios');
    try {
      const result = await this.repository.costOrderDetails(budgetId, orderId);
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'not-active') return this.fail('El presupuesto debe estar activo para agregar detalles de OC');
      if (result === 'order-unavailable') return this.fail('Orden de costo no encontrada o no disponible para asociar');
      if (result === 'client-mismatch') return this.fail('Esta orden pertenece a otro cliente');
      if (result === 'type-mismatch') return this.fail('La orden de costo debe ser interna y compatible con Producción Interna');
      return { success: true, data: result.map((row) => ({ ...row, total: Number(row.total ?? 0), totalCobrado: Number(row.totalCobrado ?? 0), disponible: this.round2(Number(row.disponible ?? 0)) })), message: result.length ? null : 'La orden no tiene detalles disponibles' };
    } catch (error) { return this.error(error); }
  }

  async addCostOrderDetail(idRaw: unknown, userId: number, roleId: number, payload: CostOrderDetailPayload): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'edit', 'No tienes permiso para editar presupuestos de producción interna');
    if (forbidden) return forbidden;
    const budgetId = this.toPositive(idRaw);
    const orderId = this.toPositive(payload.orderId);
    const orderDetailId = this.toPositive(payload.orderDetailId);
    const assigned = this.toNumber(payload.assigned, NaN);
    const idServicio = this.toPositive(payload.idServicio);
    const unidad = this.text(payload.unidad);
    if (!budgetId || !orderId || !orderDetailId || !Number.isFinite(assigned) || assigned <= 0) return this.fail('Orden, detalle y valor asignado son obligatorios');
    try {
      const result = await this.repository.addCostOrderDetail(budgetId, orderId, orderDetailId, this.round2(assigned), userId, { idServicio, unidad });
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'not-active') return this.fail('El presupuesto debe estar activo para agregar detalles de OC');
      if (result === 'order-unavailable') return this.fail('Orden de costo no encontrada o no disponible para asociar');
      if (result === 'client-mismatch') return this.fail('Esta orden pertenece a otro cliente');
      if (result === 'detail-unavailable') return this.fail('Detalle de orden de costo no encontrado');
      if (result === 'type-mismatch') return this.fail('La orden de costo debe ser interna y compatible con Producción Interna');
      if (result === 'unavailable') return this.fail('El valor asignado debe ser mayor a cero y no superar el disponible');
      return {
        success: true,
        data: {
          id: budgetId,
          detail: {
            ...result,
            valor: this.round2(Number(result.valor ?? 0)),
            incentivo: 0,
            valorAsignadoOc: this.round2(Number(result.valorAsignadoOc ?? 0)),
            editableCost: false,
          },
        },
        message: 'Detalle de orden de costo agregado correctamente',
      };
    } catch (error) { return this.error(error); }
  }

  async print(idRaw: unknown, roleId: number): Promise<ApiResponse<any>> {
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    const forbidden = await this.requireAction(roleId, 'print', 'No tienes permiso para imprimir presupuestos');
    if (forbidden) return forbidden;
    try {
      const result = await this.repository.markPrinted(id);
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      return {
        success: true,
        data: { id, alreadyPrinted: result === 'already-printed', stateChanged: result === 'ok', orderPrinted: false },
        message: result === 'already-printed'
          ? 'Presupuesto ya estaba impreso'
          : result === 'skipped-state'
            ? 'Presupuesto listo para imprimir sin cambio de estado'
            : 'Presupuesto marcado como impreso',
      };
    } catch (error) { return this.error(error); }
  }

  async addOrder(idRaw: unknown, roleId: number, body: any): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'add-order', 'No tienes permiso para agregar orden al presupuesto');
    if (forbidden) return forbidden;
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const result = await this.repository.updateOrderNumber(id, this.text(body?.order));
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'invalid-state') return this.fail('Solo se puede agregar orden a presupuestos activos o impresos');
      return { success: true, data: { id }, message: 'Orden agregada correctamente' };
    } catch (error) { return this.error(error); }
  }

  async replace(idRaw: unknown, userId: number, roleId: number): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'replace', 'No tienes permiso para reemplazar presupuestos de producción interna');
    if (forbidden) return forbidden;
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const result = await this.repository.replace(id, userId);
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'invalid-state') return this.fail('Solo se pueden reemplazar presupuestos en estado Nota Crédito');
      if (result === 'sequence-not-found') return this.fail('No existe consecutivo configurado para presupuesto');
      return { success: true, data: { id: result }, message: `Presupuesto #${result} creado como reemplazo` };
    } catch (error) { return this.error(error); }
  }

  async printData(idRaw: unknown, roleId: number): Promise<ApiResponse<any>> {
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    const forbidden = await this.requireAction(roleId, 'print', 'No tienes permiso para imprimir presupuestos');
    if (forbidden) return forbidden;
    try {
      const { header, details, billing, bill } = await this.repository.printData(id);
      if (!header) return this.fail('Presupuesto no encontrado');
      const valor = this.round2(Number(header.valor ?? 0));
      const porcDescuento = Number(header.descuento ?? 0);
      const porcIva = Number(header.iva ?? 0);
      const descuento = this.round2(valor * (porcDescuento / 100));
      const subtotal = this.round2(valor - descuento);
      const iva = this.round2(subtotal * (porcIva / 100));
      const subtotalConIva = this.round2(subtotal + iva);
      const spa = 0;
      const ivaSpa = 0;
      const porcSpa = 0;
      const porcIvaSpa = 0;
      const total = this.round2(Number(header.total ?? subtotalConIva));
      const numImpresiones = Number(header.numImpresiones ?? -1);
      return {
        success: true,
        data: {
          company: {
            name: billing?.razonSocial || billing?.nombreComercial || FALLBACK_COMPANY.name,
            commercialName: billing?.nombreComercial || FALLBACK_COMPANY.commercialName,
            nit: this.withDv(billing?.nit ?? null, billing?.dv ?? null) || FALLBACK_COMPANY.nit,
            address: billing?.direccion || FALLBACK_COMPANY.address,
            city: billing?.ciudad || FALLBACK_COMPANY.city,
            department: billing?.departamento || FALLBACK_COMPANY.department,
            country: billing?.pais || FALLBACK_COMPANY.country,
            phone: billing?.telefono || FALLBACK_COMPANY.phone,
          },
          budget: {
            id: Number(header.id),
            fecha: this.date(header.fecha),
            estado: header.estado ?? null,
            idEstado: Number(header.idEstado ?? 0),
            copyLabel: numImpresiones < 0 ? 'ORIGINAL' : 'DUPLICADO',
            numImpresiones,
            ordenCliente: header.ordenCliente ?? null,
            cotizacion: header.cotizacion ?? null,
            formaPago: header.formaPago ?? null,
            observacion: header.observacion ?? null,
            factura: bill?.consecutivo ?? null,
          },
          order: { id: null, observacion: null, copyLabel: 'ORIGINAL', numImpresiones: -1, history: [] },
          client: { name: header.cliente ?? null, nit: header.clienteDocumento ?? null, address: header.clienteDireccion ?? null, phone: header.clienteTelefono ?? null, city: header.clienteCiudad ?? null },
          provider: { name: header.proveedor ?? null, nit: header.proveedorDocumento ?? null, address: header.proveedorDireccion ?? null, phone: header.proveedorTelefono ?? null, city: header.proveedorCiudad ?? null },
          campaign: header.campana ?? null,
          product: header.producto ?? null,
          service: header.servicio ?? null,
          details: details.map((row) => ({ id: Number(row.id), detalle: row.detalle ?? '', valor: this.round2(Number(row.valor ?? 0) * (Number(row.cantidad ?? 1) || 1)), servicio: row.servicio ?? null, incentivo: Number(row.incentivo ?? 0), incentivoArea: row.incentivoArea ?? null, incentivoMedio: row.incentivoMedio ?? null })),
          totals: { valor, descuento, subtotal, iva, subtotalConIva, spa, ivaSpa, total, porcDescuento, porcIva, porcSpa, porcIvaSpa },
          creator: { name: header.usuario ?? null },
        },
        message: null,
      };
    } catch (error) { return this.error(error); }
  }

  async anule(idRaw: unknown, userId: number, roleId: number, body: any): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'anule', 'No tienes permiso para anular presupuestos de producción interna');
    if (forbidden) return forbidden;
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    const observation = this.text(body?.observacion);
    try {
      const result = await this.repository.anule(id, userId, observation);
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'invalid-state') return this.fail('El presupuesto no está disponible para anulación');
      if (result === 'has-bill') return this.fail('No se puede anular: el presupuesto tiene factura asociada');
      if (result === 'sequence-not-found') return this.fail('No existe consecutivo configurado para anulación de presupuesto');
      if (result === 'requires-observation') return this.fail('El motivo de anulación es obligatorio cuando el presupuesto tiene órdenes de costo asociadas');
      if (result === 'cost-order-link-unavailable') return this.fail('No se puede anular: las asociaciones con órdenes de costo están incompletas y requieren revisión manual');
      return { success: true, data: { id }, message: 'Presupuesto anulado correctamente' };
    } catch (error) { return this.error(error); }
  }

  async duplicate(idRaw: unknown, userId: number, roleId: number): Promise<ApiResponse<any>> {
    const forbidden = await this.requireAction(roleId, 'duplicate', 'No tienes permiso para duplicar presupuestos de producción interna');
    if (forbidden) return forbidden;
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const result = await this.repository.duplicate(id, userId);
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'sequence-not-found') return this.fail('No existe consecutivo configurado para presupuesto');
      return { success: true, data: { id: result }, message: `Presupuesto #${result} duplicado correctamente` };
    } catch (error) { return this.error(error); }
  }

  private normalizeHeader(payload: BudgetPayload, defaults: Pick<FinancialTaxDefaults, 'iva' | 'spa' | 'ivaSpa'>): any | string {
    const idCliente = this.toPositive(payload.idCliente);
    const idCampana = this.toPositive(payload.idCampana);
    const idProducto = this.toPositive(payload.idProducto);
    const idServicio = this.toPositive(payload.idServicio);
    const idDepartamento = this.text(payload.idDepartamento);
    const idCiudad = this.toPositive(payload.idCiudad);
    if (!idCliente || !idCampana || !idProducto || !idServicio) return 'Cliente, campaña, producto y servicio son obligatorios';
    return { idCliente, idProveedor: 0, idCampana, idProducto, idServicio, contrato: this.toNullablePositive(payload.contrato) ?? 0, idDepartamento, idCiudad, ordenCliente: this.text(payload.ordenCliente), formaPago: null, cotizacion: this.text(payload.cotizacion), observacion: this.text(payload.observacion), ordenObservacion: null, descuento: this.toNumber(payload.descuento, 0), iva: this.toNumber(payload.iva, defaults.iva), spa: 0, ivaSpa: 0 };
  }

  private normalizeDetail(payload: DetailPayload, defaultIva: number): any | string {
    const idServicio = this.toPositive(payload.idServicio);
    const detalle = this.text(payload.detalle);
    const unidad = this.text(payload.unidad);
    const valor = this.toNumber(payload.valor, NaN);
    const cantidad = this.toNumber(payload.cantidad, 1);
    if (!idServicio || !unidad || !this.validUnit(unidad) || !detalle || !Number.isFinite(valor) || valor < 0 || !Number.isFinite(cantidad) || cantidad <= 0) return 'Servicio, unidad, detalle, cantidad y valor son obligatorios';
    return { idServicio, detalle, valor, cantidad, unidad, iva: this.toNumber(payload.iva, defaultIva), incentivo: 0 };
  }

  private financialTaxDefaults(): Promise<FinancialTaxDefaults> {
    return this.taxParameters.defaults({
      iva: this.config.defaultIva,
      spa: this.config.defaultSpa,
      ivaSpa: this.config.defaultIvaSpa,
      specialSpa: this.config.specialSpa,
    });
  }

  private toPositive(value: unknown): number | null { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; }
  private toNullablePositive(value: unknown): number | null { const n = Number(value); return Number.isInteger(n) && n >= 0 ? n : null; }
  private toNumber(value: unknown, fallback: number): number { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  private validUnit(value: string): boolean { return ['1', '2', '3', '4', '5', '6'].includes(value); }
  private round2(n: number): number { return Math.round(n * 100) / 100; }
  private text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
  private date(value: Date | string | null): string | null { return value instanceof Date ? value.toISOString().slice(0, 10) : value ? String(value).slice(0, 10) : null; }
  private supportDirectory(id: number): string { return resolve(INTERNAL_PRODUCTION_SUPPORT_DIR, String(LEGACY_INTERNAL_MODULE), String(id)); }
  private safeSupportFilename(value: string): string | null {
    const clean = basename(value).replace(/[\\/]/g, '').replace(/[<>:"|?*\u0000-\u001F]/g, '_').trim();
    if (!clean || clean === '.' || clean === '..') return null;
    return clean.slice(0, 180);
  }
  supportReadStream(path: string) { return createReadStream(path); }
  private resolveListActions(row: { idEstado: number | null; numImpresiones: number | null }, permissions: Set<string>): string[] {
    const state = Number(row.idEstado ?? 0);
    const prints = Number(row.numImpresiones ?? -1);
    const actions: string[] = [];
    if (permissions.has('print')) actions.push('print');
    if (state !== LEGACY_CANCELLED_STATUS && permissions.has('support')) actions.push('support');
    if (permissions.has('view-anule') && state === LEGACY_CANCELLED_STATUS) actions.push('view-anule');
    if (permissions.has('edit') && state === this.config.statuses.active && prints === -1) actions.push('edit');
    if (permissions.has('duplicate')) actions.push('duplicate');
    if (permissions.has('replace') && state === this.config.statuses.creditNote) actions.push('replace');
    if (permissions.has('add-order') && [this.config.statuses.printed, this.config.statuses.active].includes(state)) actions.push('add-order');
    if (permissions.has('anule') && ((state === this.config.statuses.active && prints === -1) || state === this.config.statuses.printed)) actions.push('anule');
    return actions;
  }
  private async hasAction(roleId: number, action: string): Promise<boolean> { return (await this.permissionsService.getRoleModuleActions(roleId, INTERNAL_PRODUCTION_BUDGETS_MODULE)).has(action); }
  private async hasModuleAccess(roleId: number): Promise<boolean> { return this.permissionsService.hasMenuAccess(roleId, INTERNAL_PRODUCTION_BUDGETS_MENU_CODES); }
  private async requireModuleAccess(roleId: number): Promise<ApiResponse<any> | null> { return await this.hasModuleAccess(roleId) ? null : { success: false, data: null, message: 'No tienes permiso para consultar presupuestos de producción interna', errorCode: 'INTERNAL_PRODUCTION_BUDGET_FORBIDDEN' }; }
  private async requireAction(roleId: number, action: string, message: string): Promise<ApiResponse<any> | null> {
    const forbidden = await this.requireModuleAccess(roleId);
    if (forbidden) return forbidden;
    return await this.hasAction(roleId, action) ? null : { success: false, data: null, message, errorCode: 'INTERNAL_PRODUCTION_BUDGET_FORBIDDEN' };
  }
  private withDv(nit: string | number | null, dv: string | number | null): string | null {
    if (!nit) return null;
    const base = String(nit);
    return dv === null || dv === undefined || dv === '' ? base : `${base}-${dv}`;
  }
  private fail(message: string): ApiResponse<any> { return { success: false, data: null, message, errorCode: 'INTERNAL_PRODUCTION_BUDGET_VALIDATION' }; }
  private error(error: unknown): ApiResponse<any> { console.error(error); return { success: false, data: null, message: 'No se pudo procesar Presupuesto Producción Interna', errorCode: 'INTERNAL_PRODUCTION_BUDGET_SERVER_ERROR' }; }
}
