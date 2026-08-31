import { Injectable } from '@nestjs/common';
import { CostOrdersCompensationReportFilters, CostOrdersCompensationReportQuery, CostOrdersCompensationReportRow, CostOrdersReportFilters, CostOrdersReportOptions, CostOrdersReportQuery, CostOrdersReportRow } from './reports.types';
import { ReportsRepository } from './reports.repository';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async getCostOrdersOptions(): Promise<{ success: true; data: CostOrdersReportOptions; message: null } | { success: false; data: null; message: string }> {
    try {
      const [clientes, proveedores] = await Promise.all([
        this.reportsRepository.findClients(),
        this.reportsRepository.findProviders(),
      ]);
      return {
        success: true,
        data: {
          clientes: clientes.map((row) => ({ id: Number(row.id), label: row.label })),
          proveedores: proveedores.map((row) => ({ id: Number(row.id), label: row.label })),
        },
        message: null,
      };
    } catch {
      return { success: false, data: null, message: 'No se pudieron cargar las opciones del reporte' };
    }
  }

  async exportCostOrders(query: CostOrdersReportQuery): Promise<{ filename: string; content: string }> {
    const filters = this.normalizeFilters(query);
    const rows = await this.reportsRepository.findCostOrdersReport(filters);
    const filename = `reporte-ordenes-costo-${filters.fechaIni}_a_${filters.fechaFin}.csv`;
    return { filename, content: this.toCsv(rows) };
  }

  async exportCostOrdersCompensation(query: CostOrdersCompensationReportQuery): Promise<{ filename: string; content: string }> {
    const filters = this.normalizeCompensationFilters(query);
    const rows = await this.reportsRepository.findCostOrdersCompensationReport(filters);
    const filename = `reporte-ordenes-costo-compensacion-${filters.status}-${filters.fechaIni}_a_${filters.fechaFin}.csv`;
    return { filename, content: this.toCompensationCsv(rows) };
  }

  private normalizeFilters(query: CostOrdersReportQuery): CostOrdersReportFilters {
    const fechaIni = this.toDateString(query.fechaIni);
    const fechaFin = this.toDateString(query.fechaFin);
    if (!fechaIni || !fechaFin) throw new ReportsValidationError('Fecha desde y fecha hasta son obligatorias');
    if (fechaIni > fechaFin) throw new ReportsValidationError('La fecha desde no puede ser mayor a la fecha hasta');
    return {
      fechaIni,
      fechaFin,
      cliente: this.toOptionalId(query.cliente),
      proveedor: this.toOptionalId(query.proveedor),
    };
  }

  private normalizeCompensationFilters(query: CostOrdersCompensationReportQuery): CostOrdersCompensationReportFilters {
    const fechaIni = this.toDateString(query.fechaIni);
    const fechaFin = this.toDateString(query.fechaFin);
    if (!fechaIni || !fechaFin) throw new ReportsValidationError('Fecha desde y fecha hasta son obligatorias');
    if (fechaIni > fechaFin) throw new ReportsValidationError('La fecha desde no puede ser mayor a la fecha hasta');
    if (query.status !== 'cobrados' && query.status !== 'pendientes') {
      throw new ReportsValidationError('El estado del reporte debe ser cobrados o pendientes');
    }
    return { fechaIni, fechaFin, status: query.status };
  }

  private toDateString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return DATE_PATTERN.test(trimmed) ? trimmed : null;
  }

  private toOptionalId(value: unknown): number | null {
    if (value === undefined || value === null || value === '' || value === 'all') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private toCsv(rows: CostOrdersReportRow[]): string {
    const headers = [
      'Fecha', 'Orden', 'Usuario', 'Ppto ingresado', 'Ppto asociado', 'Observación/Guía',
      'Cliente', 'NIT cliente', 'SAP cliente', 'Proveedor', 'NIT proveedor', 'SAP proveedor',
      'Detalle', 'Campaña', 'Producto', 'Valor', 'Descuento', 'IVA', 'Total', 'Cobrado',
      'Faltante', 'Servicio', 'CEBE', 'Tipo', 'Estado',
    ];
    const lines = [headers, ...rows.map((row) => [
      this.formatDate(row.fecha), row.orden, row.usuario, row.pptoIngresado, row.pptoAsociado, row.observacionGuia,
      row.cliente, row.clienteNit, row.clienteSap, row.proveedor, row.proveedorNit, row.proveedorSap,
      row.detalle, row.campana, row.producto, row.valor, row.descuento, row.iva, row.total, row.cobrado,
      row.faltante, row.servicio, row.cebe, row.tipo, row.estado,
    ])];
    return '\uFEFF' + lines.map((line) => line.map((value) => this.csvCell(value)).join(';')).join('\r\n');
  }

  private toCompensationCsv(rows: CostOrdersCompensationReportRow[]): string {
    const headers = [
      '# de orden', 'Cliente', 'Proveedor', 'Estado', 'Creador/Usuario', 'Observación',
      'Valor bruto', 'Total orden', 'Total cobrado', 'Total faltante', 'Servicio', 'Tipo',
      'Detalle', 'Valor detalle', 'Cobrado detalle', 'Faltante detalle',
    ];
    let previousOrder: CostOrdersCompensationReportRow['orden'] | undefined;
    const lines = [headers, ...rows.map((row) => {
      const isRepeatedOrder = previousOrder !== undefined && row.orden === previousOrder;
      previousOrder = row.orden;

      return [
        isRepeatedOrder ? null : row.orden,
        isRepeatedOrder ? null : row.cliente,
        isRepeatedOrder ? null : row.proveedor,
        isRepeatedOrder ? null : row.estado,
        isRepeatedOrder ? null : row.usuario,
        isRepeatedOrder ? null : row.observacion,
        isRepeatedOrder ? null : row.valorBruto,
        isRepeatedOrder ? null : row.totalOrden,
        isRepeatedOrder ? null : row.totalCobrado,
        isRepeatedOrder ? null : row.totalFaltante,
        isRepeatedOrder ? null : row.servicio,
        isRepeatedOrder ? null : row.tipo,
        row.detalle,
        row.valorDetalle,
        row.cobradoDetalle,
        row.faltanteDetalle,
      ];
    })];
    return '\uFEFF' + lines.map((line) => line.map((value) => this.csvCell(value)).join(';')).join('\r\n');
  }

  private csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value).replace(/\r?\n/g, ' ');
    return /[";]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private formatDate(value: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }
}

export class ReportsValidationError extends Error {}
