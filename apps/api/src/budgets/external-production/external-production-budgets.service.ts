import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { basename, resolve } from 'path';
import externalProductionBudgetConfig from '../../config/external-production-budget.config';
import { FinancialTaxDefaults } from '../../financial-parameters/financial-tax-parameters.types';
import { FinancialTaxParametersService } from '../../financial-parameters/financial-tax-parameters.service';
import { EXTERNAL_PRODUCTION_SUPPORT_DIR } from '../../uploads-path';
import { ExternalProductionBudgetsRepository } from './external-production-budgets.repository';
import { ApiResponse, BudgetPayload, CostOrderDetailPayload, DetailPayload, ListQuery } from './external-production-budgets.types';

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

const LEGACY_EXTERNAL_MODULE = 6;
const LEGACY_CANCELLED_STATUS = 9999;
const EXTERNAL_PRODUCTION_BUDGETS_MODULE = 'external-production-budgets';
const SUPPORT_MAX_SIZE = 10 * 1024 * 1024;

@Injectable()
export class ExternalProductionBudgetsService {
  constructor(
    private readonly repository: ExternalProductionBudgetsRepository,
    private readonly taxParameters: FinancialTaxParametersService,
    @Inject(externalProductionBudgetConfig.KEY)
    private readonly config: ConfigType<typeof externalProductionBudgetConfig>,
  ) {}

  async list(query: ListQuery, roleId = 0): Promise<ApiResponse<any>> {
    try {
      const page = this.toPositive(query.page) ?? 1;
      const pageSize = Math.min(this.toPositive(query.pageSize) ?? PAGE_SIZE, MAX_PAGE_SIZE);
      const [{ rows, total }, legacyPermissions] = await Promise.all([
        this.repository.list({ search: this.text(query.search), estado: this.toPositive(query.estado) }, pageSize, (page - 1) * pageSize),
        this.repository.legacyButtonPermissions(roleId),
      ]);
      return { success: true, data: { items: rows.map((row) => ({ ...row, fecha: this.date(row.fecha), editable: Number(row.idEstado) === this.config.statuses.active, incentivoXServicio: Number(row.incentivoXServicio ?? 0) === 1, actions: this.resolveListActions(row, legacyPermissions) })), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), moduleCode: EXTERNAL_PRODUCTION_BUDGETS_MODULE }, message: null };
    } catch (error) { return this.error(error); }
  }

  async statuses(): Promise<ApiResponse<any>> {
    try { return { success: true, data: await this.repository.statuses(), message: null }; }
    catch (error) { return this.error(error); }
  }

  async defaults(idCliente?: unknown, idServicio?: unknown): Promise<ApiResponse<any>> {
    const clientId = this.toPositive(idCliente);
    const serviceId = this.toPositive(idServicio);
    const defaults = await this.financialTaxDefaults();
    const special = !!clientId && !!serviceId && clientId === this.config.specialSpaClientId && this.config.specialSpaServiceIds.includes(serviceId);
    return { success: true, data: { iva: defaults.iva, spa: special ? defaults.specialSpa : defaults.spa, ivaSpa: defaults.ivaSpa, editableIncentiveCostServiceIds: this.config.editableIncentiveCostServiceIds }, message: null };
  }

  async options(type: string, value?: unknown): Promise<ApiResponse<any>> {
    try {
      if (!['clients', 'providers', 'services', 'campaigns', 'products'].includes(type)) return this.fail('Catálogo inválido');
      if ((type === 'campaigns' || type === 'products') && !this.toPositive(value)) return { success: true, data: [], message: null };
      return { success: true, data: await this.repository.options(type as any, type === 'campaigns' || type === 'products' ? this.toPositive(value) : this.text(value)), message: null };
    } catch (error) { return this.error(error); }
  }

  async get(rawId: unknown): Promise<ApiResponse<any>> {
    const id = this.toPositive(rawId);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const data = await this.repository.get(id);
      if (!data.header) return this.fail('Presupuesto no encontrado');
      return { success: true, data: { ...data.header, fecha: this.date(data.header.fecha), editable: Number(data.header.idEstado) === this.config.statuses.active, incentivoXServicio: Number(data.header.incentivoXServicio ?? 0) === 1, details: data.details.map((row) => ({ ...row, incentivo: Number(row.incentivo ?? 0), valor: Number(row.valor ?? 0), editableCost: row.idServicio ? this.config.editableIncentiveCostServiceIds.includes(Number(row.idServicio)) : false })), orders: data.orders.map((row) => ({ ...row, fecha: this.date(row.fecha), fechaImp: this.date(row.fechaImp) })) }, message: null };
    } catch (error) { return this.error(error); }
  }

  async incentives(query: any): Promise<ApiResponse<any>> {
    const clientId = this.toPositive(query.idCliente);
    const providerId = this.toPositive(query.idProveedor);
    const serviceId = this.toPositive(query.idServicio);
    if (!clientId || !providerId || !serviceId) return this.fail('Cliente, proveedor y servicio son obligatorios');
    try { return { success: true, data: (await this.repository.incentives(clientId, providerId, serviceId)).map((row) => ({ ...row, editableCost: this.config.editableIncentiveCostServiceIds.includes(serviceId) })), message: null }; }
    catch (error) { return this.error(error); }
  }

  async orders(id?: unknown): Promise<ApiResponse<any>> {
    try { return { success: true, data: (await this.repository.orders(this.toPositive(id))).map((row) => ({ ...row, fecha: this.date(row.fecha), fechaImp: this.date(row.fechaImp) })), message: null }; }
    catch (error) { return this.error(error); }
  }

  async support(idRaw: unknown): Promise<ApiResponse<any>> {
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
          attachments: attachments.map((row) => ({ ...row, fecha: this.date(row.fecha), modulo: LEGACY_EXTERNAL_MODULE, downloadUrl: `/api/budgets/external-production/${id}/support/${encodeURIComponent(row.nombre || '')}` })),
        },
        message: null,
      };
    }
    catch (error) { return this.error(error); }
  }

  async uploadSupport(idRaw: unknown, file?: { originalname?: string; size?: number; buffer?: Buffer }): Promise<ApiResponse<any>> {
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

  async downloadSupport(idRaw: unknown, rawFilename: unknown): Promise<{ ok: true; path: string; filename: string } | { ok: false; message: string }> {
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

  async deleteSupport(idRaw: unknown, rawFilename: unknown): Promise<ApiResponse<any>> {
    const id = this.toPositive(idRaw);
    const filename = typeof rawFilename === 'string' ? this.safeSupportFilename(rawFilename) : null;
    if (!id || !filename) return this.fail('Soporte no encontrado');
    try {
      const row = await this.repository.supportAttachment(id, filename);
      if (!row) return this.fail('Soporte no encontrado');
      const directory = this.supportDirectory(id);
      const fullPath = resolve(directory, filename);
      if (!fullPath.startsWith(directory + '/')) return this.fail('Soporte no encontrado');
      await unlink(fullPath).catch(() => undefined);
      await this.repository.deleteSupportAttachment(id, filename);
      return { success: true, data: { id }, message: 'Soporte eliminado correctamente' };
    } catch (error) { return this.error(error); }
  }

  async create(userId: number, payload: BudgetPayload): Promise<ApiResponse<any>> {
    try {
      const normalized = this.normalizeHeader(payload, await this.financialTaxDefaults());
      if (typeof normalized === 'string') return this.fail(normalized);
      const id = await this.repository.create(userId, normalized);
      if (id === 'sequence-not-found') return this.fail('No existe consecutivo configurado para presupuesto');
      return { success: true, data: { id }, message: `Presupuesto #${id} creado correctamente` };
    } catch (error) { return this.error(error); }
  }

  async update(idRaw: unknown, userId: number, payload: BudgetPayload): Promise<ApiResponse<any>> {
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

  async saveDetail(idRaw: unknown, detailRaw: unknown, payload: DetailPayload): Promise<ApiResponse<any>> {
    const budgetId = this.toPositive(idRaw);
    const detailId = this.toPositive(detailRaw);
    if (!budgetId) return this.fail('Presupuesto no encontrado');
    try {
      const normalized = this.normalizeDetail(payload, (await this.financialTaxDefaults()).iva);
      if (typeof normalized === 'string') return this.fail(normalized);
      const result = await this.repository.saveDetail(budgetId, detailId ?? null, normalized);
      if (result === 'not-found') return this.fail('Presupuesto o detalle no encontrado');
      if (result === 'not-active') return this.fail('El presupuesto debe estar activo para ser modificado');
      if (result === 'incentive-not-found') return this.fail('Incentivo no encontrado para el servicio seleccionado');
      return { success: true, data: { id: budgetId }, message: detailId ? 'Detalle actualizado correctamente' : 'Detalle agregado correctamente' };
    } catch (error) { return this.error(error); }
  }

  async deleteDetail(idRaw: unknown, detailRaw: unknown, userId: number): Promise<ApiResponse<any>> {
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

  async costOrderDetails(idRaw: unknown, orderRaw: unknown): Promise<ApiResponse<any>> {
    const budgetId = this.toPositive(idRaw);
    const orderId = this.toPositive(orderRaw);
    if (!budgetId || !orderId) return this.fail('Presupuesto y orden de costo son obligatorios');
    try {
      const result = await this.repository.costOrderDetails(budgetId, orderId);
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'not-active') return this.fail('El presupuesto debe estar activo para agregar detalles de OC');
      if (result === 'order-unavailable') return this.fail('Orden de costo no encontrada o incompatible con cliente/proveedor');
      if (result === 'type-mismatch') return this.fail('La orden de costo debe ser externa y compatible con Producción Externa');
      if (result === 'iva-mismatch') return this.fail('La orden de costo no tiene IVA compatible con el presupuesto');
      return { success: true, data: result.map((row) => ({ ...row, total: Number(row.total ?? 0), totalCobrado: Number(row.totalCobrado ?? 0), disponible: this.round2(Number(row.disponible ?? 0)) })), message: result.length ? null : 'La orden no tiene detalles disponibles' };
    } catch (error) { return this.error(error); }
  }

  async addCostOrderDetail(idRaw: unknown, userId: number, payload: CostOrderDetailPayload): Promise<ApiResponse<any>> {
    const budgetId = this.toPositive(idRaw);
    const orderId = this.toPositive(payload.orderId);
    const orderDetailId = this.toPositive(payload.orderDetailId);
    const assigned = this.toNumber(payload.assigned, NaN);
    const incentivo = this.toNullablePositive(payload.incentivo) ?? 0;
    const rawCost = this.toNumber(payload.costoIncentivo, NaN);
    const costoIncentivo = Number.isFinite(rawCost) ? rawCost : undefined;
    if (!budgetId || !orderId || !orderDetailId || !Number.isFinite(assigned) || assigned <= 0) return this.fail('Orden, detalle y valor asignado son obligatorios');
    try {
      const result = await this.repository.addCostOrderDetail(budgetId, orderId, orderDetailId, this.round2(assigned), userId, (await this.financialTaxDefaults()).iva, { incentivo, costoIncentivo });
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'not-active') return this.fail('El presupuesto debe estar activo para agregar detalles de OC');
      if (result === 'order-unavailable') return this.fail('Orden de costo no encontrada o incompatible con cliente/proveedor');
      if (result === 'detail-unavailable') return this.fail('Detalle de orden de costo no encontrado');
      if (result === 'incentive-not-found') return this.fail('Incentivo no encontrado para el servicio seleccionado');
      if (result === 'type-mismatch') return this.fail('La orden de costo debe ser externa y compatible con Producción Externa');
      if (result === 'iva-mismatch') return this.fail('La orden de costo no tiene IVA compatible con el presupuesto');
      if (result === 'unavailable') return this.fail('El valor asignado debe ser mayor a cero y no superar el disponible');
      return { success: true, data: { id: budgetId }, message: 'Detalle de orden de costo agregado correctamente' };
    } catch (error) { return this.error(error); }
  }

  async print(idRaw: unknown): Promise<ApiResponse<any>> {
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const result = await this.repository.markPrinted(id);
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      return {
        success: true,
        data: { id, alreadyPrinted: result === 'already-printed', stateChanged: result === 'ok' },
        message: result === 'already-printed'
          ? 'Presupuesto ya estaba impreso'
          : result === 'skipped-state'
            ? 'Presupuesto listo para imprimir sin cambio de estado'
            : 'Presupuesto marcado como impreso',
      };
    } catch (error) { return this.error(error); }
  }

  async addOrder(idRaw: unknown, body: any): Promise<ApiResponse<any>> {
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const result = await this.repository.updateOrderNumber(id, this.text(body?.order));
      if (result === 'not-found') return this.fail('Presupuesto no encontrado');
      if (result === 'invalid-state') return this.fail('Solo se puede agregar orden a presupuestos activos o impresos');
      return { success: true, data: { id }, message: 'Orden agregada correctamente' };
    } catch (error) { return this.error(error); }
  }

  async replace(idRaw: unknown, userId: number): Promise<ApiResponse<any>> {
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

  async printData(idRaw: unknown): Promise<ApiResponse<any>> {
    const id = this.toPositive(idRaw);
    if (!id) return this.fail('Presupuesto no encontrado');
    try {
      const { header, details, billing, bill } = await this.repository.printData(id);
      if (!header) return this.fail('Presupuesto no encontrado');
      const valor = this.round2(Number(header.valor ?? 0));
      const porcDescuento = Number(header.descuento ?? 0);
      const porcIva = Number(header.iva ?? 0);
      const porcSpa = Number(header.spa ?? 0);
      const porcIvaSpa = Number(header.ivaSpa ?? 0);
      const descuento = this.round2(valor * (porcDescuento / 100));
      const subtotal = this.round2(valor - descuento);
      const iva = this.round2(subtotal * (porcIva / 100));
      const subtotalConIva = this.round2(subtotal + iva);
      const spa = this.round2(subtotal * (porcSpa / 100));
      const ivaSpa = this.round2(spa * (porcIvaSpa / 100));
      const total = this.round2(Number(header.total ?? subtotalConIva + spa + ivaSpa));
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
          order: { id: header.ordenId ? Number(header.ordenId) : null, observacion: header.ordenObservacion ?? null },
          client: { name: header.cliente ?? null, nit: header.clienteDocumento ?? null, address: header.clienteDireccion ?? null, phone: header.clienteTelefono ?? null, city: header.clienteCiudad ?? null },
          provider: { name: header.proveedor ?? null, nit: header.proveedorDocumento ?? null, address: header.proveedorDireccion ?? null, phone: header.proveedorTelefono ?? null, city: header.proveedorCiudad ?? null },
          campaign: header.campana ?? null,
          product: header.producto ?? null,
          service: header.servicio ?? null,
          details: details.map((row) => ({ id: Number(row.id), detalle: row.detalle ?? '', valor: Number(row.valor ?? 0), servicio: row.servicio ?? null, incentivo: Number(row.incentivo ?? 0), incentivoArea: row.incentivoArea ?? null, incentivoMedio: row.incentivoMedio ?? null })),
          totals: { valor, descuento, subtotal, iva, subtotalConIva, spa, ivaSpa, total, porcDescuento, porcIva, porcSpa, porcIvaSpa },
          creator: { name: header.usuario ?? null },
        },
        message: null,
      };
    } catch (error) { return this.error(error); }
  }

  async anule(idRaw: unknown, userId: number, body: any): Promise<ApiResponse<any>> {
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

  async duplicate(idRaw: unknown, userId: number): Promise<ApiResponse<any>> {
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
    const idProveedor = this.toPositive(payload.idProveedor);
    const idCampana = this.toPositive(payload.idCampana);
    const idProducto = this.toPositive(payload.idProducto);
    const idServicio = this.toPositive(payload.idServicio);
    if (!idCliente || !idProveedor || !idCampana || !idProducto || !idServicio) return 'Cliente, proveedor, campaña, producto y servicio son obligatorios';
    return { idCliente, idProveedor, idCampana, idProducto, idServicio, contrato: this.toNullablePositive(payload.contrato) ?? 0, ordenCliente: this.text(payload.ordenCliente), formaPago: this.text(payload.formaPago), cotizacion: this.text(payload.cotizacion), observacion: this.text(payload.observacion), ordenObservacion: this.text(payload.ordenObservacion), descuento: this.toNumber(payload.descuento, 0), iva: this.toNumber(payload.iva, defaults.iva), spa: this.toNumber(payload.spa, defaults.spa), ivaSpa: this.toNumber(payload.ivaSpa, defaults.ivaSpa) };
  }

  private normalizeDetail(payload: DetailPayload, defaultIva: number): any | string {
    const idServicio = this.toPositive(payload.idServicio);
    const detalle = this.text(payload.detalle);
    const valor = this.toNumber(payload.valor, NaN);
    const incentivo = this.toNullablePositive(payload.incentivo) ?? 0;
    if (!idServicio || !detalle || !Number.isFinite(valor) || valor < 0) return 'Servicio, detalle y valor son obligatorios';
    const rawCost = this.toNumber(payload.costoIncentivo, NaN);
    return { idServicio, detalle, valor, unidad: this.text(payload.unidad) ?? '1', iva: this.toNumber(payload.iva, defaultIva), incentivo, costoIncentivo: incentivo > 0 && this.config.editableIncentiveCostServiceIds.includes(idServicio) && Number.isFinite(rawCost) ? rawCost : undefined };
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
  private round2(n: number): number { return Math.round(n * 100) / 100; }
  private text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
  private date(value: Date | string | null): string | null { return value instanceof Date ? value.toISOString().slice(0, 10) : value ? String(value).slice(0, 10) : null; }
  private supportDirectory(id: number): string { return resolve(EXTERNAL_PRODUCTION_SUPPORT_DIR, String(LEGACY_EXTERNAL_MODULE), String(id)); }
  private safeSupportFilename(value: string): string | null {
    const clean = basename(value).replace(/[\\/]/g, '').replace(/[<>:"|?*\u0000-\u001F]/g, '_').trim();
    if (!clean || clean === '.' || clean === '..') return null;
    return clean.slice(0, 180);
  }
  supportReadStream(path: string) { return createReadStream(path); }
  private resolveListActions(row: { idEstado: number | null; numImpresiones: number | null }, permissions: Set<string>): string[] {
    const state = Number(row.idEstado ?? 0);
    const prints = Number(row.numImpresiones ?? -1);
    const actions = ['print'];
    if (state !== LEGACY_CANCELLED_STATUS) actions.push('print-order', 'support');
    if (permissions.has('BtnEditPpto') && state === LEGACY_CANCELLED_STATUS) actions.push('view-anule');
    if (permissions.has('BtnEditPpto') && state === this.config.statuses.active && prints === -1) actions.push('edit');
    if (permissions.has('BtnDupliPpto')) actions.push('duplicate');
    if (permissions.has('BtnReplacePpto') && state === this.config.statuses.creditNote) actions.push('replace');
    if (permissions.has('BtnAddOrderPpto') && [this.config.statuses.printed, this.config.statuses.active].includes(state)) actions.push('add-order');
    if (permissions.has('BtnAnulePpto') && ((state === this.config.statuses.active && prints === -1) || state === this.config.statuses.printed)) actions.push('anule');
    return actions;
  }
  private withDv(nit: string | number | null, dv: string | number | null): string | null {
    if (!nit) return null;
    const base = String(nit);
    return dv === null || dv === undefined || dv === '' ? base : `${base}-${dv}`;
  }
  private fail(message: string): ApiResponse<any> { return { success: false, data: null, message, errorCode: 'EXTERNAL_PRODUCTION_BUDGET_VALIDATION' }; }
  private error(error: unknown): ApiResponse<any> { console.error(error); return { success: false, data: null, message: 'No se pudo procesar Presupuesto Producción Externa', errorCode: 'EXTERNAL_PRODUCTION_BUDGET_SERVER_ERROR' }; }
}
