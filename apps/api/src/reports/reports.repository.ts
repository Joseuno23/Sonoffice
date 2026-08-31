import { Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { DbService } from '../db/db.service';
import { CostOrdersCompensationReportFilters, CostOrdersCompensationReportRow, CostOrdersReportFilters, CostOrdersReportRow, ReportOptionRow } from './reports.types';

type ColumnSet = Set<string>;

const COST_ORDER_STATUS_FINALIZED = 8;
const COST_ORDER_ANNULLED_OR_CANCELLED_STATUS_IDS = [4, 14] as const;
const COST_ORDER_ANNULLED_OR_CANCELLED_STATUS_NAMES = ['ANULAD%', 'CANCELAD%'] as const;

@Injectable()
export class ReportsRepository {
  private readonly columnsCache = new Map<string, ColumnSet>();

  constructor(private readonly db: DbService) {}

  async findClients(): Promise<ReportOptionRow[]> {
    return this.db.execute<ReportOptionRow[]>(
      `SELECT id_client AS id, nombre AS label
       FROM sys_clients
       WHERE cliente = 1 AND (id_status = 1 OR id_status IS NULL)
       ORDER BY nombre`,
    );
  }

  async findProviders(): Promise<ReportOptionRow[]> {
    return this.db.execute<ReportOptionRow[]>(
      `SELECT id_client AS id, nombre AS label
       FROM sys_clients
       WHERE proveedor = 1 AND (id_status = 1 OR id_status IS NULL)
       ORDER BY nombre`,
    );
  }

  async findCostOrdersReport(filters: CostOrdersReportFilters): Promise<CostOrdersReportRow[]> {
    const branches: { sql: string; params: (string | number)[] }[] = [];

    if (await this.hasTable('sys_orden_costos') && await this.hasTable('sys_detalle_costo')) {
      branches.push(await this.buildNewCostOrdersBranch(filters));
    }

    if (await this.hasTable('ord_costos') && await this.hasTable('det_ordcostos')) {
      const branch = await this.buildLegacyCostOrdersBranch(filters);
      if (branch) branches.push(branch);
    }

    if (!branches.length) return [];

    return this.db.execute<CostOrdersReportRow[]>(
      `${branches.map((branch) => branch.sql).join('\nUNION ALL\n')}\nORDER BY fecha, orden`,
      branches.flatMap((branch) => branch.params),
    );
  }

  async findCostOrdersCompensationReport(filters: CostOrdersCompensationReportFilters): Promise<CostOrdersCompensationReportRow[]> {
    if (!(await this.hasTable('sys_orden_costos')) || !(await this.hasTable('sys_detalle_costo'))) return [];

    const excludedPendingStatusIds = COST_ORDER_ANNULLED_OR_CANCELLED_STATUS_IDS.join(', ');
    const excludedPendingStatusNames = COST_ORDER_ANNULLED_OR_CANCELLED_STATUS_NAMES
      .map((pattern) => `UPPER(TRIM(e_eligible.description)) NOT LIKE '${pattern}'`)
      .join(' AND ');
    const pendingBalanceCondition = `EXISTS (
            SELECT 1
            FROM sys_detalle_costo d_pending
            WHERE d_pending.id_orden = o_eligible.id_orden
              AND GREATEST(COALESCE(d_pending.total, 0) - COALESCE(d_pending.total_cobrado, 0), 0) > 0
          )`;
    const statusCondition = filters.status === 'cobrados'
      ? `o_eligible.id_estado = ${COST_ORDER_STATUS_FINALIZED}`
      : `(o_eligible.id_estado IS NULL OR o_eligible.id_estado NOT IN (${excludedPendingStatusIds}))
         AND (e_eligible.description IS NULL OR (${excludedPendingStatusNames}))
         AND ${pendingBalanceCondition}`;

    return this.db.execute<CostOrdersCompensationReportRow[]>(
      `SELECT
         o.id_orden AS orden,
         c.nombre AS cliente,
         p.nombre AS proveedor,
         e.description AS estado,
         u.name AS usuario,
         o.observacion AS observacion,
         COALESCE(o.valor, 0) AS valorBruto,
         COALESCE(o.total, 0) AS totalOrden,
         COALESCE(o.cobrado, 0) AS totalCobrado,
         COALESCE(o.faltante, 0) AS totalFaltante,
         s.nombre AS servicio,
         CASE o.tipo WHEN 'I' THEN 'INTERNA' WHEN 'E' THEN 'EXTERNA' ELSE o.tipo END AS tipo,
         d.detalle AS detalle,
         COALESCE(d.total, 0) AS valorDetalle,
         COALESCE(d.total_cobrado, 0) AS cobradoDetalle,
          GREATEST(COALESCE(d.total, 0) - COALESCE(d.total_cobrado, 0), 0) AS faltanteDetalle
        FROM sys_orden_costos o
        INNER JOIN (
          SELECT o_eligible.id_orden
          FROM sys_orden_costos o_eligible
          LEFT JOIN sys_status e_eligible ON e_eligible.id_status = o_eligible.id_estado
          WHERE o_eligible.fecha BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
            AND ${statusCondition}
        ) eligible_orders ON eligible_orders.id_orden = o.id_orden
        INNER JOIN sys_detalle_costo d ON d.id_orden = o.id_orden
        LEFT JOIN sys_clients c ON c.id_client = o.id_cliente
        LEFT JOIN sys_clients p ON p.id_client = o.id_proveedor
        LEFT JOIN sys_status e ON e.id_status = o.id_estado
        LEFT JOIN sys_users u ON u.id_users = o.id_usuario
        LEFT JOIN sys_tipo_servicio s ON s.id_tipo_servicio = o.id_servicio
        ORDER BY o.id_orden, d.id_detalle`,
      [filters.fechaIni, filters.fechaFin],
    );
  }

  private async buildNewCostOrdersBranch(filters: CostOrdersReportFilters) {
    const o = await this.columns('sys_orden_costos');
    const d = await this.columns('sys_detalle_costo');
    const select = `
      SELECT
        o.fecha AS fecha,
        o.id_orden AS orden,
        u.name AS usuario,
        o.tipo_ppto AS pptoIngresado,
        GROUP_CONCAT(DISTINCT ppto.id_ppto ORDER BY ppto.id_ppto SEPARATOR ', ') AS pptoAsociado,
        o.observacion AS observacionGuia,
        c.nombre AS cliente,
        c.documento AS clienteNit,
        c.sap AS clienteSap,
        p.nombre AS proveedor,
        p.documento AS proveedorNit,
        p.sap AS proveedorSap,
        d.detalle AS detalle,
        ca.camp_nombre AS campana,
        pr.pdcl_nombre AS producto,
        ${this.numberExpr(d, 'd', ['valor'], '0')} AS valor,
        (${this.numberExpr(o, 'o', ['valor'], '0')} * (${this.numberExpr(o, 'o', ['porc_descuento'], '0')} / 100)) AS descuento,
        (((${this.numberExpr(o, 'o', ['valor'], '0')}) - (${this.numberExpr(o, 'o', ['valor'], '0')} * (${this.numberExpr(o, 'o', ['porc_descuento'], '0')} / 100))) * (${this.numberExpr(o, 'o', ['porc_iva'], '0')} / 100)) AS iva,
        ${this.numberExpr(d, 'd', ['total'], '0')} AS total,
        ${this.numberExpr(d, 'd', ['total_cobrado'], '0')} AS cobrado,
        GREATEST(${this.numberExpr(d, 'd', ['total'], '0')} - ${this.numberExpr(d, 'd', ['total_cobrado'], '0')}, 0) AS faltante,
        s.nombre AS servicio,
        ${this.textExpr(o, 'o', ['cebe', 'CEBE', 'id_cebe'])} AS cebe,
        CASE o.tipo WHEN 'I' THEN 'INTERNA' WHEN 'E' THEN 'EXTERNA' ELSE o.tipo END AS tipo,
        e.description AS estado
      FROM sys_orden_costos o
      LEFT JOIN sys_detalle_costo d ON d.id_orden = o.id_orden
      LEFT JOIN sys_oc_ppto ppto ON ppto.id_orden = o.id_orden AND (ppto.id_detalle_orden = d.id_detalle OR ppto.id_detalle_orden IS NULL)
      LEFT JOIN sys_users u ON u.id_users = o.id_usuario
      LEFT JOIN sys_clients c ON c.id_client = o.id_cliente
      LEFT JOIN sys_clients p ON p.id_client = o.id_proveedor
      LEFT JOIN cat_campanas ca ON ca.camp_id = o.id_campana
      LEFT JOIN cat_prodsclies pr ON pr.pdcl_id = o.id_producto
      LEFT JOIN sys_tipo_servicio s ON s.id_tipo_servicio = o.id_servicio
      LEFT JOIN sys_status e ON e.id_status = o.id_estado`;
    const { where, params } = this.buildWhere('o.fecha', 'o.id_cliente', 'o.id_proveedor', filters);
    return { sql: `${select}\n${where}\nGROUP BY o.id_orden, d.id_detalle`, params };
  }

  private async buildLegacyCostOrdersBranch(filters: CostOrdersReportFilters): Promise<{ sql: string; params: (string | number)[] } | null> {
    const o = await this.columns('ord_costos');
    const d = await this.columns('det_ordcostos');
    const users = await this.columns('usuarios');
    const statuses = await this.columns('cat_estados');
    const orderId = this.pick(o, ['ordcos_id', 'id_orden', 'id', 'id_ordcosto']);
    const detailOrderId = this.pick(d, ['ordcos_id', 'id_orden', 'id_ordcosto']);
    const date = this.pick(o, ['ordcos_fecha', 'fecha', 'ord_fecha']);
    if (!orderId || !detailOrderId || !date) return null;

    const clientId = this.pick(o, ['id_cliente', 'pvcl_id_clie', 'cliente_id']);
    const providerId = this.pick(o, ['id_proveedor', 'pvcl_id_prov', 'proveedor_id']);
    const userId = this.pick(o, ['id_usuario', 'usr_id', 'user_id']);
    const campaignId = this.pick(o, ['id_campana', 'camp_id', 'campana_id']);
    const productId = this.pick(o, ['id_producto', 'pdcl_id', 'producto_id']);
    const serviceId = this.pick(o, ['id_servicio', 'id_tipo_servicio', 'servicio_id']);
    const statusId = this.pick(o, ['id_estado', 'est_id', 'estado_id']);
    const legacyUserId = this.pick(users, ['usr_id']);
    const legacyUserName = this.pick(users, ['usr_nombre']);
    const legacyStatusId = this.pick(statuses, ['est_id']);
    const legacyStatusName = this.pick(statuses, ['est_nombre']);
    const canJoinLegacyUser = Boolean(userId && legacyUserId && legacyUserName);
    const canJoinLegacyStatus = Boolean(statusId && legacyStatusId && legacyStatusName);
    const typeColumn = this.pick(o, ['tipo', 'ordcos_tipo']);
    const typeExpr = typeColumn
      ? `CASE o.${typeColumn} WHEN 'I' THEN 'INTERNA' WHEN 'E' THEN 'EXTERNA' ELSE o.${typeColumn} END`
      : 'NULL';
    const select = `
      SELECT
        o.${date} AS fecha,
        o.${orderId} AS orden,
        ${canJoinLegacyUser ? `u.${legacyUserName}` : 'NULL'} AS usuario,
        ${this.textExpr(o, 'o', ['ordcos_noorden', 'tipo_ppto', 'tipoppto', 'ppto_ingresado'])} AS pptoIngresado,
        ${this.textExpr(o, 'o', ['no_presup', 'ppto_asociado'])} AS pptoAsociado,
        ${this.concatTextExpr([
          this.textExpr(o, 'o', ['ordcos_observa', 'observacion', 'obs', 'ordcos_observacion']),
          this.textExpr(o, 'o', ['ordcos_guia', 'guia', 'num_guiaprov']),
        ], ' ')} AS observacionGuia,
        c.nombre AS cliente,
        c.documento AS clienteNit,
        c.sap AS clienteSap,
        p.nombre AS proveedor,
        p.documento AS proveedorNit,
        p.sap AS proveedorSap,
        GROUP_CONCAT(${this.textExpr(d, 'd', ['dordcos_detalle', 'detalle', 'docostos_detalle', 'descripcion'])} SEPARATOR ' - ') AS detalle,
        ca.camp_nombre AS campana,
        pr.pdcl_nombre AS producto,
        ${this.numberExpr(o, 'o', ['ordcos_valor', 'valor'], '0')} AS valor,
        ${this.numberExpr(o, 'o', ['ordcos_desc', 'descuento'], '0')} AS descuento,
        ${this.numberExpr(o, 'o', ['ordcos_iva', 'iva'], '0')} AS iva,
        ${this.numberExpr(o, 'o', ['ordcos_total', 'total'], '0')} AS total,
        ${this.numberExpr(o, 'o', ['ordcos_vlrcobrado', 'cobrado'], '0')} AS cobrado,
        ${this.numberExpr(o, 'o', ['ordcos_vlrfaltante', 'faltante'], '0')} AS faltante,
        s.nombre AS servicio,
        s.tpsv_cebe AS cebe,
        ${typeExpr} AS tipo,
        ${canJoinLegacyStatus ? `e.${legacyStatusName}` : 'NULL'} AS estado
      FROM ord_costos o
      LEFT JOIN det_ordcostos d ON d.${detailOrderId} = o.${orderId}
      ${canJoinLegacyUser ? `LEFT JOIN usuarios u ON u.${legacyUserId} = o.${userId}` : ''}
      LEFT JOIN sys_clients c ON ${clientId ? `c.id_client = o.${clientId}` : '1 = 0'}
      LEFT JOIN sys_clients p ON ${providerId ? `p.id_client = o.${providerId}` : '1 = 0'}
      LEFT JOIN cat_campanas ca ON ${campaignId ? `ca.camp_id = o.${campaignId}` : '1 = 0'}
      LEFT JOIN cat_prodsclies pr ON ${productId ? `pr.pdcl_id = o.${productId}` : '1 = 0'}
      LEFT JOIN sys_tipo_servicio s ON ${serviceId ? `s.id_tipo_servicio = o.${serviceId}` : '1 = 0'}
      ${canJoinLegacyStatus ? `LEFT JOIN cat_estados e ON e.${legacyStatusId} = o.${statusId}` : ''}`;
    const { where, params } = this.buildWhere(`o.${date}`, clientId ? `o.${clientId}` : null, providerId ? `o.${providerId}` : null, filters);
    return { sql: `${select}\n${where}\nGROUP BY o.${orderId}`, params };
  }

  private buildWhere(dateExpr: string, clientExpr: string | null, providerExpr: string | null, filters: CostOrdersReportFilters) {
    const conditions = [`${dateExpr} BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)`];
    const params: (string | number)[] = [filters.fechaIni, filters.fechaFin];
    if (filters.cliente !== null && clientExpr) {
      conditions.push(`${clientExpr} = ?`);
      params.push(filters.cliente);
    }
    if (filters.proveedor !== null && providerExpr) {
      conditions.push(`${providerExpr} = ?`);
      params.push(filters.proveedor);
    }
    return { where: `WHERE ${conditions.join(' AND ')}`, params };
  }

  private async hasTable(table: string): Promise<boolean> {
    return (await this.columns(table)).size > 0;
  }

  private async columns(table: string): Promise<ColumnSet> {
    const cached = this.columnsCache.get(table);
    if (cached) return cached;
    const rows = await this.db.execute<(RowDataPacket & { columnName: string })[]>(
      `SELECT COLUMN_NAME AS columnName
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [table],
    );
    const set = new Set(rows.map((row) => row.columnName));
    this.columnsCache.set(table, set);
    return set;
  }

  private pick(columns: ColumnSet, names: string[]): string | null {
    return names.find((name) => columns.has(name)) ?? null;
  }

  private textExpr(columns: ColumnSet, alias: string, names: string[]): string {
    const column = this.pick(columns, names);
    return column ? `${alias}.${column}` : 'NULL';
  }

  private numberExpr(columns: ColumnSet, alias: string, names: string[], fallback: string): string {
    const column = this.pick(columns, names);
    return column ? `COALESCE(${alias}.${column}, ${fallback})` : fallback;
  }

  private concatTextExpr(expressions: string[], separator: string): string {
    const availableExpressions = expressions.filter((expression) => expression !== 'NULL');
    if (!availableExpressions.length) return 'NULL';
    return `CONCAT_WS('${separator}', ${availableExpressions.join(', ')})`;
  }
}
