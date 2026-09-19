import { Injectable } from '@nestjs/common';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ExecuteValues, ResultSetHeader } from 'mysql2';
import { DbService } from '../db/db.service';
import {
  CostOrderBudgetLineRow,
  CostOrderBudgetLinkRow,
  CostOrderBudgetTypeRow,
  CostOrderCompensateAssociationRow,
  CostOrderCompensateDetailRow,
  CostOrderCountRow,
  CostOrderDefaultsRow,
  CostOrderDuplicateCandidateRow,
  CostOrderDuplicateHeaderRow,
  CostOrderDetailRow,
  CostOrderFinalizeRow,
  CostOrderHeaderRow,
  CostOrderOptionRow,
  CostOrderPrintBillingRow,
  CostOrderPrintBudgetRow,
  CostOrderPrintHeaderRow,
  CostOrderReplacementDetailRow,
  CostOrderReplacementHeaderRow,
  CostOrderRow,
} from './cost-orders.types';

interface BudgetStructure {
  headerTable: string;
  detailTable: string;
  headerId: string;
  detailId: string;
  detailJoinAlias: string;
  totalExpr: string;
  detailExpr: string;
  stateExpr: string;
  headerStatusColumn: string;
  clientExpr: string;
  providerExpr: string;
  dateExpr: string;
}

interface LockRow extends RowDataPacket {
  id: number;
}

interface FinalObservationRow extends RowDataPacket {
  id: number;
  obsFinal: string | null;
}

interface OrderLockRow extends RowDataPacket {
  id: number;
  idEstado: number;
}

interface DetailLockRow extends RowDataPacket {
  idDetalle: number;
}

interface BudgetLinkLockRow extends RowDataPacket {
  associationId?: number;
  idPpto: number;
  idDetallePpto: number;
  idDetalleOrden?: number;
  modulo: number;
  cobradoItem: number;
}

interface CompensateOrderLockRow extends RowDataPacket {
  id: number;
  idEstado: number | null;
  idCliente: number | null;
  idProveedor: number | null;
  tipoPpto: number | string | null;
}

type CompensateAssociationResult = { status: 'ok'; associated: number } | 'order-unavailable' | 'budget-unavailable' | 'detail-unavailable' | 'unavailable' | 'internal-type-mismatch' | 'external-type-mismatch';
type CompensateReverseResult = 'ok' | 'identifier-unavailable' | 'not-found' | 'order-unavailable' | 'budget-unavailable' | 'detail-unavailable';
type CreateOrderResult = number | 'budget-unavailable' | 'budget-type-mismatch' | 'unavailable';

class CompensateRollbackError extends Error {
  constructor(readonly result: Exclude<CompensateAssociationResult, { status: 'ok'; associated: number }>) {
    super(result);
  }
}

class CreateOrderRollbackError extends Error {
  constructor(readonly result: Exclude<CreateOrderResult, number>) {
    super(result);
  }
}

export const BUDGET_STATUS = {
  ACTIVE: 1,
  PRINTED: 5,
  CREDIT_NOTE: 47,
  CANCELED: 9999,
} as const;

export const COST_ORDER_STATUS = {
  ACTIVE: 1,
  CANCELED: 4,
  FINALIZED: 8,
  PENDING: 25,
  PRINTED: 27,
  DOC_EQUIVALENTE: 28,
} as const;

const PRINT_STATE_EXCLUSIONS = [4, 8, 25, 28] as const;
const REPLACE_INVALID_BUDGET_LINKS = 'COST_ORDER_REPLACE_INVALID_BUDGET_LINKS';
export const BUDGET_STRUCTURES: Record<number, BudgetStructure> = {
  1: { headerTable: 'presup_avisos', detailTable: 'det_avisos', headerId: 'psav_id', detailId: 'detavi_id', detailJoinAlias: 'psav_id', totalExpr: 'd.detavi_total', detailExpr: `CONCAT('titulo: ', d.detavi_titulo, ' Publicacion de ', d.detavi_numavisos, ' aviso(s) de ', IF((d.detavi_tamano <> ''), d.detavi_tamano, CONVERT(CONCAT(d.detavi_numcolum, ' Columna(s) x ', d.detavi_numcentim, ' Cms ') USING utf8)), ' con posicion ', d.detavi_posicion, ', los dia(s) ', d.detavi_fechinser)`, stateExpr: 'p.psav_estado', headerStatusColumn: 'psav_estado', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.psav_fecha' },
  2: { headerTable: 'presup_clasificados', detailTable: 'det_clasi', headerId: 'pscf_id', detailId: 'dclasi_id', detailJoinAlias: 'pscf_id', totalExpr: 'd.dclasi_total', detailExpr: `CONCAT('titulo: ', d.dclasi_titulo, ' Clasificado de ', d.dclasi_palabras, ' palabra(s) en la seccion ', d.dclasi_seccion, ' los dia(s) ', d.dclasi_fechas)`, stateExpr: 'p.pscf_estado', headerStatusColumn: 'pscf_estado', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.pscf_fecha' },
  3: { headerTable: 'presup_revis', detailTable: 'det_revis', headerId: 'psrev_id', detailId: 'drevis_id', detailJoinAlias: 'psrev_id', totalExpr: 'd.drevis_total', detailExpr: `CONCAT('titulo: ', d.drevis_titulo, ' Publicacion de ', d.drevis_numavisos, ' aviso(s) de ', d.drevis_tamano, ' publicado el dia(s) ', d.drevis_fechinser)`, stateExpr: 'p.psrev_estado', headerStatusColumn: 'psrev_estado', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.psrev_fecha' },
  4: { headerTable: 'presup_radio', detailTable: 'det_radio', headerId: 'psrad_id', detailId: 'drad_id', detailJoinAlias: 'psrad_id', totalExpr: 'd.drad_total', detailExpr: `IF((d.drad_detalle <> ''), d.drad_detalle, CONCAT(e.emis_nombre, ' Transmision de ', d.drad_totalcuna, ' cunas en el(los) programa(s) ', r.progr_nombre, ' el(los) dia(s) del ', d.drad_fechaini, ' al ', d.drad_fechafin))`, stateExpr: 'p.psrad_estado', headerStatusColumn: 'psrad_estado', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.psrad_fecha' },
  5: { headerTable: 'presup_tv', detailTable: 'det_tv', headerId: 'pstv_id', detailId: 'dtv_id', detailJoinAlias: 'pstv_id', totalExpr: 'd.dtv_total', detailExpr: `CONCAT('Transmision de ', d.dtv_numcomer, ' comercial(les) en el programa ', d.dtv_programa, ' correspondiente al ', d.dtv_fechasalida, ' con referencia', d.dtv_referencia)`, stateExpr: 'p.pstv_estado', headerStatusColumn: 'pstv_estado', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.pstv_fecha' },
  6: { headerTable: 'presup_prode', detailTable: 'det_prode', headerId: 'psex_id', detailId: 'dprode_id', detailJoinAlias: 'psex_id', totalExpr: 'd.dprode_valor', detailExpr: 'd.dprode_detalle', stateExpr: 'p.psex_estado', headerStatusColumn: 'psex_estado', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.psex_fecha' },
  7: { headerTable: 'presup_prodi', detailTable: 'det_prodi', headerId: 'psin_id', detailId: 'dpsin_id', detailJoinAlias: 'psin_id', totalExpr: 'd.dpsin_total', detailExpr: 'd.dpsin_detalle', stateExpr: 'p.psin_estado', headerStatusColumn: 'psin_estado', clientExpr: 'p.pvcl_id_clie', providerExpr: '0', dateExpr: 'p.psin_fechpresup' },
  8: { headerTable: 'publicidad_exterior', detailTable: 'det_pubext', headerId: 'pubext_id', detailId: 'dpubext_id', detailJoinAlias: 'pubext_id', totalExpr: 'd.dpubext_total', detailExpr: 'd.dpubext_detalle', stateExpr: 'p.est_id', headerStatusColumn: 'est_id', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.pubext_fecha' },
  9: { headerTable: 'impresos', detailTable: 'det_impresos', headerId: 'imp_id', detailId: 'dimp_id', detailJoinAlias: 'imp_id', totalExpr: 'd.dimp_total', detailExpr: `CONCAT(cc.concp_nmb, ' de ', ce.elem_nombre, ' en ', d.dimp_material, ' de tamano ', d.dimp_tamano, ', cantidad ', d.dimp_cantidad, ', descripcion : ', d.dimp_observacion, '.')`, stateExpr: 'p.est_id', headerStatusColumn: 'est_id', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.imp_fecha' },
  10: { headerTable: 'art_publi', detailTable: 'det_artpub', headerId: 'artp_id', detailId: 'dartp_id', detailJoinAlias: 'artp_id', totalExpr: 'd.dartp_total', detailExpr: `CONCAT(d.dartp_producto, ' de ', d.dartp_tamano, ' en ', d.dartp_material, ' con tinta(s) ', d.dartp_tintas, ' de las siguientes caracteristicas ', d.dartp_caracteristicas, '.')`, stateExpr: 'p.est_id', headerStatusColumn: 'est_id', clientExpr: 'p.pvcl_id_clie', providerExpr: 'p.pvcl_id_prov', dateExpr: 'p.artp_fecha' },
};

export interface NewCostOrderHeader {
  fecha: string;
  idCliente: number;
  idProveedor: number;
  idProducto: number;
  idCampana: number;
  idServicio: number;
  idEstado: number;
  idUsuario: number;
  tipo: string; // 'I' | 'E'
  observacion: string | null;
  porcIva: number;
  porcDescuento: number;
  valor: number;
  total: number;
}

export interface NewCostOrderDetail {
  detalle: string;
  cantidad: number;
  valor: number;
  total: number;
}

export interface CostOrderFilters {
  search: string | null;
  estado: number | null;
  proveedor: number | null;
  fechaIni: string | null; // YYYY-MM-DD
  fechaFin: string | null; // YYYY-MM-DD
}

// Base FROM + JOINs compartidos por el listado y el conteo (una sola fuente de verdad).
const FROM_JOINS = `
  FROM sys_orden_costos o
  LEFT JOIN sys_status e ON o.id_estado = e.id_status
  LEFT JOIN sys_clients c ON o.id_cliente = c.id_client
  LEFT JOIN sys_clients p ON o.id_proveedor = p.id_client
  LEFT JOIN cat_campanas ca ON o.id_campana = ca.camp_id
  LEFT JOIN sys_users u ON o.id_usuario = u.id_users
`;

@Injectable()
export class CostOrdersRepository {
  private sysOcPptoPrimaryKeyColumn?: string | null;

  constructor(private readonly db: DbService) {}

  private async getSysOcPptoPrimaryKeyColumn(): Promise<string | null> {
    if (this.sysOcPptoPrimaryKeyColumn !== undefined) return this.sysOcPptoPrimaryKeyColumn;

    const rows = await this.db.execute<(RowDataPacket & { columnName: string })[]>(
      `SELECT k.COLUMN_NAME AS columnName
       FROM information_schema.TABLE_CONSTRAINTS t
       INNER JOIN information_schema.KEY_COLUMN_USAGE k
         ON k.CONSTRAINT_SCHEMA = t.CONSTRAINT_SCHEMA
        AND k.TABLE_NAME = t.TABLE_NAME
        AND k.CONSTRAINT_NAME = t.CONSTRAINT_NAME
       WHERE t.TABLE_SCHEMA = DATABASE()
         AND t.TABLE_NAME = 'sys_oc_ppto'
         AND t.CONSTRAINT_TYPE = 'PRIMARY KEY'
       ORDER BY k.ORDINAL_POSITION`,
    );
    if (rows.length === 1) {
      this.sysOcPptoPrimaryKeyColumn = rows[0].columnName;
      return this.sysOcPptoPrimaryKeyColumn;
    }
    return null;
  }

  private quoteIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  // Construye el WHERE dinámico con parámetros bindeados (arregla la SQL injection del legacy).
  private buildWhere(filters: CostOrderFilters): { clause: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.search) {
      const like = `%${filters.search}%`;
      conditions.push(`(
        o.id_orden LIKE ? OR e.description LIKE ? OR p.nombre LIKE ?
        OR c.nombre LIKE ? OR ca.camp_nombre LIKE ? OR u.name LIKE ? OR o.valor LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like);
    }

    if (filters.estado !== null) {
      conditions.push('o.id_estado = ?');
      params.push(filters.estado);
    }

    if (filters.proveedor !== null) {
      conditions.push('o.id_proveedor = ?');
      params.push(filters.proveedor);
    }

    if (filters.fechaIni && filters.fechaFin) {
      conditions.push('o.fecha BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(filters.fechaIni, filters.fechaFin);
    }

    const clause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return { clause, params };
  }

  async findOrders(filters: CostOrderFilters, limit: number, offset: number): Promise<CostOrderRow[]> {
    const { clause, params } = this.buildWhere(filters);
    // limit/offset ya vienen validados como enteros no negativos desde el service.
    const sql = `
      SELECT
        o.id_orden AS id,
        o.fecha AS fecha,
        e.description AS estado,
        e.color AS color,
        e.id_status AS idEstado,
        c.nombre AS cliente,
        p.nombre AS proveedor,
        ca.camp_nombre AS campana,
        u.name AS usuario,
        o.tipo AS tipo,
        o.total AS total,
        o.valor AS valor,
        CASE WHEN o.obs_final IS NOT NULL AND TRIM(o.obs_final) <> '' THEN 1 ELSE 0 END AS hasFinalObservation,
        CASE WHEN EXISTS (SELECT 1 FROM sys_oc_ppto ppto WHERE ppto.id_orden = o.id_orden) THEN 1 ELSE 0 END AS hasBudgetLinks
      ${FROM_JOINS}
      ${clause}
      ORDER BY o.id_orden DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return this.db.execute<CostOrderRow[]>(sql, params);
  }

  async findFinalObservation(id: number): Promise<string | null | undefined> {
    const rows = await this.db.execute<FinalObservationRow[]>(
      `SELECT id_orden AS id, obs_final AS obsFinal
       FROM sys_orden_costos
       WHERE id_orden = ?`,
      [id],
    );
    if (rows.length !== 1) return undefined;
    return rows[0].obsFinal ?? null;
  }

  async addFinalObservation(orderId: number, userId: number, observation: string): Promise<'ok' | 'not-found' | 'already-exists'> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [rows] = await connection.execute<FinalObservationRow[]>(
        `SELECT id_orden AS id, obs_final AS obsFinal
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      if (rows.length !== 1) return 'not-found';
      if ((rows[0].obsFinal ?? '').trim()) return 'already-exists';

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET obs_final = ?, id_usuario_mod = ?, fecha_mod = NOW()
         WHERE id_orden = ?`,
        [observation, userId, orderId],
      );
      return 'ok';
    });
  }

  async countOrders(filters: CostOrderFilters): Promise<number> {
    const { clause, params } = this.buildWhere(filters);
    const sql = `SELECT COUNT(*) AS total ${FROM_JOINS} ${clause}`;
    const rows = await this.db.execute<CostOrderCountRow[]>(sql, params);
    return Number(rows[0]?.total ?? 0);
  }

  async findDefaults(): Promise<CostOrderDefaultsRow | null> {
    const rows = await this.db.execute<CostOrderDefaultsRow[]>(
      `SELECT iva FROM sys_data_billing LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async findBudgetCategories(): Promise<CostOrderBudgetTypeRow[]> {
    const supportedIds = Object.keys(BUDGET_STRUCTURES).map(Number);
    const placeholders = supportedIds.map(() => '?').join(',');
    return this.db.execute<CostOrderBudgetTypeRow[]>(
      `SELECT id_categoria AS id, descripcion AS label
       FROM sys_categoria
       WHERE tipo LIKE '%P%' AND id_categoria IN (${placeholders})
       ORDER BY descripcion`,
      supportedIds,
    );
  }

  async findDuplicateCandidates(search: string | null, limit: number): Promise<CostOrderDuplicateCandidateRow[]> {
    const params: (string | number)[] = [];
    let searchClause = '';
    if (search) {
      const like = `%${search}%`;
      searchClause = `AND (o.id_orden LIKE ? OR c.nombre LIKE ? OR p.nombre LIKE ? OR ca.camp_nombre LIKE ?)`;
      params.push(like, like, like, like);
    }

    return this.db.execute<CostOrderDuplicateCandidateRow[]>(
      `SELECT
        o.id_orden AS id,
        o.fecha AS fecha,
        c.nombre AS cliente,
        p.nombre AS proveedor,
        ca.camp_nombre AS campana,
        o.total AS total
       ${FROM_JOINS}
       WHERE o.fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
         AND o.fecha < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         ${searchClause}
       ORDER BY o.id_orden DESC
       LIMIT ${Number(limit)}`,
      params,
    );
  }

  // Catálogo de estados usados por órdenes de costo (para el filtro de estado en el front).
  async findStatuses(): Promise<CostOrderOptionRow[]> {
    const sql = `
      SELECT DISTINCT e.id_status AS id, e.description AS label
      FROM sys_orden_costos o
      INNER JOIN sys_status e ON o.id_estado = e.id_status
      WHERE e.description IS NOT NULL AND TRIM(e.description) <> ''
      ORDER BY e.description
    `;
    return this.db.execute<CostOrderOptionRow[]>(sql);
  }

  // --- Dropdowns del formulario de creación ---

  // Clientes activos (typeahead: filtra por nombre, tope de resultados). Sin scoping por equipo
  // por ahora (el scoping legacy por rol queda como mejora futura, ver deuda).
  async findClients(search: string | null, limit: number): Promise<CostOrderOptionRow[]> {
    const params: (string | number)[] = [];
    let where = 'WHERE cliente = 1 AND id_status = 1';
    if (search) {
      where += ' AND nombre LIKE ?';
      params.push(`%${search}%`);
    }
    return this.db.execute<CostOrderOptionRow[]>(
      `SELECT id_client AS id, nombre AS label FROM sys_clients ${where} ORDER BY nombre LIMIT ${Number(limit)}`,
      params,
    );
  }

  async findProviders(search: string | null, limit: number): Promise<CostOrderOptionRow[]> {
    const params: (string | number)[] = [];
    let where = 'WHERE proveedor = 1 AND id_status = 1';
    if (search) {
      where += ' AND nombre LIKE ?';
      params.push(`%${search}%`);
    }
    return this.db.execute<CostOrderOptionRow[]>(
      `SELECT id_client AS id, nombre AS label FROM sys_clients ${where} ORDER BY nombre LIMIT ${Number(limit)}`,
      params,
    );
  }

  // Servicios filtrados por tipo (I/E).
  async findServices(tipo: string): Promise<CostOrderOptionRow[]> {
    return this.db.execute<CostOrderOptionRow[]>(
      `SELECT id_tipo_servicio AS id, nombre AS label
       FROM sys_tipo_servicio
       WHERE tipo = ? AND (id_estado = 1 OR id_estado IS NULL)
       ORDER BY nombre`,
      [tipo],
    );
  }

  // Campañas de un cliente.
  async findCampaigns(clientId: number): Promise<CostOrderOptionRow[]> {
    return this.db.execute<CostOrderOptionRow[]>(
      `SELECT camp_id AS id, camp_nombre AS label
       FROM cat_campanas
       WHERE pvcl_id = ? AND est_id = 1
       ORDER BY camp_nombre`,
      [clientId],
    );
  }

  // Productos/rubros de un cliente.
  async findProducts(clientId: number): Promise<CostOrderOptionRow[]> {
    return this.db.execute<CostOrderOptionRow[]>(
      `SELECT pdcl_id AS id, pdcl_nombre AS label
       FROM cat_prodsclies
       WHERE pvcl_id = ? AND est_id = 1
       ORDER BY pdcl_nombre`,
      [clientId],
    );
  }

  // Validaciones puntuales de existencia (evita insertar FKs inválidas).
  async clientExists(id: number, flag: 'cliente' | 'proveedor'): Promise<boolean> {
    const rows = await this.db.execute<CostOrderOptionRow[]>(
      `SELECT id_client AS id, nombre AS label FROM sys_clients WHERE id_client = ? AND ${flag} = 1 LIMIT 1`,
      [id],
    );
    return rows.length > 0;
  }

  // --- Edición ---

  // Cabecera completa de una orden para editar.
  async findOrderById(id: number): Promise<CostOrderHeaderRow | null> {
    const rows = await this.db.execute<CostOrderHeaderRow[]>(
      `SELECT
        o.id_orden AS id,
        o.id_estado AS idEstado,
        e.description AS estado,
        e.color AS color,
        o.id_cliente AS idCliente,
        c.nombre AS cliente,
        o.id_proveedor AS idProveedor,
        p.nombre AS proveedor,
        o.id_campana AS idCampana,
        ca.camp_nombre AS campana,
        o.id_producto AS idProducto,
        pr.pdcl_nombre AS producto,
        o.id_servicio AS idServicio,
        s.nombre AS servicio,
        o.tipo AS tipo,
        o.observacion AS observacion,
        o.obs_final AS finalObservation,
        o.porc_iva AS porcIva,
        o.porc_descuento AS porcDescuento,
        o.valor AS valor,
        o.total AS total,
        o.cobrado AS cobrado,
        o.faltante AS faltante,
        o.fecha AS fecha,
        o.tipo_ppto AS tipoPpto
      FROM sys_orden_costos o
      LEFT JOIN sys_status e ON o.id_estado = e.id_status
      LEFT JOIN sys_clients c ON o.id_cliente = c.id_client
      LEFT JOIN sys_clients p ON o.id_proveedor = p.id_client
      LEFT JOIN cat_campanas ca ON o.id_campana = ca.camp_id
      LEFT JOIN cat_prodsclies pr ON o.id_producto = pr.pdcl_id
      LEFT JOIN sys_tipo_servicio s ON o.id_servicio = s.id_tipo_servicio
      WHERE o.id_orden = ?
      LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  // Líneas de detalle de una orden, con flag de si están vinculadas a presupuesto.
  async findOrderDetails(id: number): Promise<CostOrderDetailRow[]> {
    return this.db.execute<CostOrderDetailRow[]>(
      `SELECT
        d.id_detalle AS idDetalle,
        d.detalle,
        d.cantidad,
        d.valor,
        d.total,
        d.total_cobrado AS totalCobrado,
        GREATEST(COALESCE(d.total, 0) - COALESCE(d.total_cobrado, 0), 0) AS faltante,
        CASE WHEN COUNT(p.id_orden) > 0 THEN 1 ELSE 0 END AS hasBudget,
        MAX(p.modulo) AS budgetTipo,
        MAX(p.id_ppto) AS budgetPpto,
        MAX(p.id_detalle_ppto) AS budgetIdDetallePpto,
        SUM(p.cobrado_item) AS budgetValorAsignado
      FROM sys_detalle_costo d
      LEFT JOIN sys_oc_ppto p ON p.id_detalle_orden = d.id_detalle
      WHERE d.id_orden = ?
      GROUP BY d.id_detalle
      ORDER BY d.id_detalle`,
      [id],
    );
  }

  async findPrintHeader(id: number): Promise<CostOrderPrintHeaderRow | null> {
    const rows = await this.db.execute<CostOrderPrintHeaderRow[]>(
      `SELECT
        o.id_orden AS id,
        o.fecha AS fecha,
        o.id_estado AS idEstado,
        e.description AS estado,
        o.tipo AS tipo,
        o.observacion AS observacion,
        o.obs_final AS finalObservation,
        o.porc_iva AS porcIva,
        o.porc_descuento AS porcDescuento,
        o.valor AS valor,
        o.total AS total,
        o.num_impresiones AS numImpresiones,
        c.nombre AS cliente,
        c.documento AS clienteDocumento,
        c.direccion AS clienteDireccion,
        c.telefono AS clienteTelefono,
        c.ciudad AS clienteCiudad,
        p.nombre AS proveedor,
        p.documento AS proveedorDocumento,
        p.direccion AS proveedorDireccion,
        p.telefono AS proveedorTelefono,
        p.ciudad AS proveedorCiudad,
        ca.camp_nombre AS campana,
        pr.pdcl_nombre AS producto,
        s.nombre AS servicio,
        u.name AS creador,
        u.email AS creadorEmail
       FROM sys_orden_costos o
       LEFT JOIN sys_status e ON o.id_estado = e.id_status
       LEFT JOIN sys_clients c ON o.id_cliente = c.id_client
       LEFT JOIN sys_clients p ON o.id_proveedor = p.id_client
       LEFT JOIN cat_campanas ca ON o.id_campana = ca.camp_id
       LEFT JOIN cat_prodsclies pr ON o.id_producto = pr.pdcl_id
       LEFT JOIN sys_tipo_servicio s ON o.id_servicio = s.id_tipo_servicio
       LEFT JOIN sys_users u ON o.id_usuario = u.id_users
       WHERE o.id_orden = ?
       LIMIT 1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findPrintBudgets(id: number): Promise<CostOrderPrintBudgetRow[]> {
    return this.db.execute<CostOrderPrintBudgetRow[]>(
      `SELECT DISTINCT id_ppto AS ppto, modulo AS tipo
       FROM sys_oc_ppto
       WHERE id_orden = ?
       ORDER BY modulo, id_ppto`,
      [id],
    );
  }

  async findPrintBilling(): Promise<CostOrderPrintBillingRow | null> {
    const rows = await this.db.execute<CostOrderPrintBillingRow[]>(
      `SELECT
        nit,
        razon_social_emisor AS razonSocial,
        nombre_comercial_emisor AS nombreComercial,
        direccion_emisor AS direccion,
        ciudad_emisor AS ciudad,
        departamento_emisor AS departamento,
        pais_emisor AS pais,
        telefono_emisor AS telefono,
        digito_verificacion_emisor AS dv
       FROM sys_data_billing
       LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  async markPrinted(id: number, userId: number): Promise<'not-found' | { idEstado: number | null; numImpresiones: number }> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [rows] = await connection.execute<(OrderLockRow & { numImpresiones: number | null })[]>(
        `SELECT id_orden AS id, id_estado AS idEstado, num_impresiones AS numImpresiones
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [id],
      );
      if (rows.length !== 1) return 'not-found';

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET num_impresiones = COALESCE(num_impresiones, -1) + 1,
             id_estado = CASE WHEN id_estado IS NULL OR id_estado NOT IN (${PRINT_STATE_EXCLUSIONS.join(',')}) THEN ? ELSE id_estado END,
             id_usuario_mod = ?,
             fecha_mod = NOW()
         WHERE id_orden = ?`,
        [COST_ORDER_STATUS.PRINTED, userId, id],
      );

      const [updatedRows] = await connection.execute<(OrderLockRow & { numImpresiones: number })[]>(
        `SELECT id_orden AS id, id_estado AS idEstado, num_impresiones AS numImpresiones
         FROM sys_orden_costos
         WHERE id_orden = ?`,
        [id],
      );
      const updated = updatedRows[0];
      return { idEstado: updated.idEstado === null ? null : Number(updated.idEstado), numImpresiones: Number(updated.numImpresiones ?? 0) };
    });
  }

  async findBudgetLines(tipo: number, ppto: number): Promise<CostOrderBudgetLineRow[]> {
    const s = BUDGET_STRUCTURES[tipo];
    const extraJoins = tipo === 4
      ? 'LEFT JOIN cat_emisoras e ON e.emis_id = d.emis_id LEFT JOIN cat_programasr r ON r.progr_id = d.progr_id'
      : tipo === 9
        ? 'LEFT JOIN cat_concepto cc ON cc.concp_id = d.concp_id LEFT JOIN cat_elementos ce ON ce.elem_id = d.elemento_id'
        : '';
    const availableExpr = tipo === 7
      ? `(${s.totalExpr} / ((COALESCE((SELECT porcentaje_interna FROM sys_data_billing LIMIT 1), 0) / 100) + 1)) - COALESCE(d.valor_asignado_oc, 0)`
      : `${s.totalExpr} - COALESCE(d.valor_asignado_oc, 0)`;
    return this.db.execute<CostOrderBudgetLineRow[]>(
      `SELECT
        p.${s.headerId} AS id,
        d.${s.detailId} AS idDetalle,
        ${s.detailExpr} AS detalle,
        ${s.totalExpr} AS total,
        ${s.stateExpr} AS estado,
        COALESCE(d.valor_asignado_oc, 0) AS valorAsignadoOc,
        COALESCE(d.ordcos_id, 0) AS ordenCosto,
        ${s.clientExpr} AS idCliente,
        ${s.providerExpr} AS idProveedor,
        ${availableExpr} AS disponible
       FROM ${s.headerTable} p
       INNER JOIN ${s.detailTable} d ON p.${s.headerId} = d.${s.detailJoinAlias}
       ${extraJoins}
       WHERE p.${s.headerId} = ?
       ORDER BY d.${s.detailId}`,
      [ppto],
    );
  }

  async findCompensateOrderDetails(orderId: number): Promise<CostOrderCompensateDetailRow[]> {
    return this.db.execute<CostOrderCompensateDetailRow[]>(
      `SELECT
        id_detalle AS idDetalle,
        detalle,
        cantidad,
        valor,
        total,
        total_cobrado AS totalCobrado,
        GREATEST(COALESCE(total, 0) - COALESCE(total_cobrado, 0), 0) AS faltante
       FROM sys_detalle_costo
       WHERE id_orden = ?
       ORDER BY id_detalle`,
      [orderId],
    );
  }

  async findCompensateAssociations(orderId: number, tipo?: number, ppto?: number): Promise<CostOrderCompensateAssociationRow[]> {
    const primaryKeyColumn = await this.getSysOcPptoPrimaryKeyColumn();
    const associationIdExpr = primaryKeyColumn ? `p.${this.quoteIdentifier(primaryKeyColumn)} AS associationId` : 'NULL AS associationId';
    const filters: string[] = [];
    const params: ExecuteValues[] = [orderId];
    if (tipo) {
      filters.push('p.modulo = ?');
      params.push(tipo);
    }
    if (ppto) {
      filters.push('p.id_ppto = ?');
      params.push(ppto);
    }

    const links = await this.db.execute<CostOrderCompensateAssociationRow[]>(
      `SELECT
        ${associationIdExpr},
        p.id_detalle_orden AS idDetalleOrden,
        p.id_detalle_ppto AS idDetallePpto,
        p.id_ppto AS idPpto,
        p.modulo,
        p.cobrado_item AS cobradoItem,
        d.detalle AS orderDetail,
        NULL AS budgetDetail
       FROM sys_oc_ppto p
       LEFT JOIN sys_detalle_costo d ON d.id_orden = p.id_orden AND d.id_detalle = p.id_detalle_orden
       WHERE p.id_orden = ?${filters.length ? ` AND ${filters.join(' AND ')}` : ''}
       ORDER BY p.id_detalle_orden, p.modulo, p.id_ppto, p.id_detalle_ppto`,
      params,
    );
    if (!links.length) return links;

    const detailByKey = new Map<string, string | null>();
    const modules = [...new Set(links.map((link) => Number(link.modulo)).filter((modulo) => BUDGET_STRUCTURES[modulo]))];
    for (const modulo of modules) {
      const s = BUDGET_STRUCTURES[modulo];
      const moduleLinks = links.filter((link) => Number(link.modulo) === modulo);
      const pptos = [...new Set(moduleLinks.map((link) => Number(link.idPpto)))];
      const details = [...new Set(moduleLinks.map((link) => Number(link.idDetallePpto)))];
      const pptoPlaceholders = pptos.map(() => '?').join(',');
      const detailPlaceholders = details.map(() => '?').join(',');
      const extraJoins = modulo === 4
        ? 'LEFT JOIN cat_emisoras e ON e.emis_id = d.emis_id LEFT JOIN cat_programasr r ON r.progr_id = d.progr_id'
        : modulo === 9
          ? 'LEFT JOIN cat_concepto cc ON cc.concp_id = d.concp_id LEFT JOIN cat_elementos ce ON ce.elem_id = d.elemento_id'
          : '';
      const rows = await this.db.execute<(RowDataPacket & { idPpto: number; idDetallePpto: number; detalle: string | null })[]>(
        `SELECT p.${s.headerId} AS idPpto, d.${s.detailId} AS idDetallePpto, ${s.detailExpr} AS detalle
         FROM ${s.headerTable} p
         INNER JOIN ${s.detailTable} d ON p.${s.headerId} = d.${s.detailJoinAlias}
         ${extraJoins}
         WHERE p.${s.headerId} IN (${pptoPlaceholders}) AND d.${s.detailId} IN (${detailPlaceholders})`,
        [...pptos, ...details],
      );
      for (const row of rows) detailByKey.set(`${modulo}:${Number(row.idPpto)}:${Number(row.idDetallePpto)}`, row.detalle ?? null);
    }

    return links.map((link) => ({
      ...link,
      budgetDetail: detailByKey.get(`${Number(link.modulo)}:${Number(link.idPpto)}:${Number(link.idDetallePpto)}`) ?? null,
    }));
  }

  async associateExistingBudgetDetails(
    orderId: number,
    userId: number,
    tipo: number,
    ppto: number,
    associations: { idDetalleOrden: number; idDetallePpto: number; valor: number }[],
  ): Promise<CompensateAssociationResult> {
    const s = BUDGET_STRUCTURES[tipo];
    const availableExpr = tipo === 7
      ? `(${s.totalExpr} / ((COALESCE((SELECT porcentaje_interna FROM sys_data_billing LIMIT 1), 0) / 100) + 1)) - COALESCE(d.valor_asignado_oc, 0)`
      : `${s.totalExpr} - COALESCE(d.valor_asignado_oc, 0)`;

    try {
      return await this.db.transaction(async (connection: PoolConnection) => {
      const [orderRows] = await connection.execute<CompensateOrderLockRow[]>(
        `SELECT id_orden AS id, id_estado AS idEstado, id_cliente AS idCliente, id_proveedor AS idProveedor, tipo_ppto AS tipoPpto
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      const order = orderRows[0];
      if (!order || [COST_ORDER_STATUS.FINALIZED, COST_ORDER_STATUS.PENDING, COST_ORDER_STATUS.CANCELED].includes(Number(order.idEstado) as 8 | 25 | 4)) return 'order-unavailable';
      const orderTipoPpto = order.tipoPpto === null || order.tipoPpto === undefined || order.tipoPpto === '' ? null : Number(order.tipoPpto);
      if (orderTipoPpto === 7 && tipo !== 7) return 'internal-type-mismatch';
      if (orderTipoPpto !== null && Number.isFinite(orderTipoPpto) && orderTipoPpto !== 7 && tipo === 7) return 'external-type-mismatch';

      const providerCondition = tipo === 7 ? '' : `AND ${s.providerExpr} = ?`;
      const budgetParams = tipo === 7 ? [ppto, Number(order.idCliente)] : [ppto, Number(order.idCliente), Number(order.idProveedor)];
      const [budgetHeaderRows] = await connection.execute<(RowDataPacket & { id: number; estado: number | null })[]>(
        `SELECT p.${s.headerId} AS id, ${s.stateExpr} AS estado
         FROM ${s.headerTable} p
         WHERE p.${s.headerId} = ?
           AND ${s.clientExpr} = ?
           ${providerCondition}
           AND ${s.stateExpr} NOT IN (${BUDGET_STATUS.CANCELED}, ${BUDGET_STATUS.CREDIT_NOTE})
         FOR UPDATE`,
        budgetParams,
      );
      const budget = budgetHeaderRows[0];
      if (!budget) return 'budget-unavailable';

      const orderTotals = new Map<number, number>();
      const budgetTotals = new Map<number, number>();
      for (const item of associations) {
        orderTotals.set(item.idDetalleOrden, Number((orderTotals.get(item.idDetalleOrden) ?? 0) + item.valor));
        budgetTotals.set(item.idDetallePpto, Number((budgetTotals.get(item.idDetallePpto) ?? 0) + item.valor));
      }

      if (associations.length > 1 && orderTotals.size !== 1) return 'detail-unavailable';

      for (const [idDetalleOrden, total] of orderTotals) {
        const [orderDetailRows] = await connection.execute<(RowDataPacket & { idDetalle: number; faltante: number })[]>(
          `SELECT id_detalle AS idDetalle, GREATEST(COALESCE(total, 0) - COALESCE(total_cobrado, 0), 0) AS faltante
           FROM sys_detalle_costo
           WHERE id_orden = ? AND id_detalle = ?
           FOR UPDATE`,
          [orderId, idDetalleOrden],
        );
        const orderDetail = orderDetailRows[0];
        if (!orderDetail) return 'detail-unavailable';
        if (associations.length === 1 && Number(orderDetail.faltante ?? 0) + 0.0001 < total) return 'unavailable';
      }

      for (const [idDetallePpto, total] of budgetTotals) {
        const [budgetDetailRows] = await connection.execute<(CostOrderBudgetLineRow & { disponible: number })[]>(
          `SELECT d.${s.detailId} AS idDetalle, ${availableExpr} AS disponible
           FROM ${s.headerTable} p
           INNER JOIN ${s.detailTable} d ON p.${s.headerId} = d.${s.detailJoinAlias}
           WHERE p.${s.headerId} = ? AND d.${s.detailId} = ?
           FOR UPDATE`,
          [ppto, idDetallePpto],
        );
        const budgetDetail = budgetDetailRows[0];
        if (!budgetDetail) return 'budget-unavailable';
        if (Number(budgetDetail.disponible ?? 0) + 0.0001 < total) return 'unavailable';
      }

      let associatedCount = 0;
      for (const item of associations) {
        let valueToAssign = item.valor;
        if (associations.length > 1) {
          const [currentDetailRows] = await connection.execute<(RowDataPacket & { faltante: number })[]>(
            `SELECT GREATEST(COALESCE(total, 0) - COALESCE(total_cobrado, 0), 0) AS faltante
             FROM sys_detalle_costo
             WHERE id_orden = ? AND id_detalle = ?
             FOR UPDATE`,
            [orderId, item.idDetalleOrden],
          );
          const faltante = Number(currentDetailRows[0]?.faltante ?? 0);
          valueToAssign = this.round2(Math.min(item.valor, faltante));
          if (valueToAssign <= 0) continue;
        }

        const [budgetUpdate] = await connection.execute<ResultSetHeader>(
          `UPDATE ${s.detailTable} d
           SET valor_asignado_oc = COALESCE(valor_asignado_oc, 0) + ?,
               ordcos_id = ?
           WHERE ${s.detailId} = ? AND (${availableExpr}) >= ?`,
          [valueToAssign, orderId, item.idDetallePpto, valueToAssign],
        );
        if (budgetUpdate.affectedRows !== 1) throw new CompensateRollbackError('unavailable');

        const [orderDetailUpdate] = await connection.execute<ResultSetHeader>(
          `UPDATE sys_detalle_costo
            SET total_cobrado = COALESCE(total_cobrado, 0) + ?
            WHERE id_orden = ? AND id_detalle = ? AND GREATEST(COALESCE(total, 0) - COALESCE(total_cobrado, 0), 0) >= ?`,
          [valueToAssign, orderId, item.idDetalleOrden, valueToAssign],
        );
        if (orderDetailUpdate.affectedRows !== 1) throw new CompensateRollbackError('unavailable');

        await connection.execute<ResultSetHeader>(
          `INSERT INTO sys_oc_ppto (id_orden, id_ppto, id_detalle_ppto, id_detalle_orden, modulo, cobrado_item)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, ppto, item.idDetallePpto, item.idDetalleOrden, tipo, valueToAssign],
        );
        associatedCount += 1;
      }

      if (associatedCount === 0) return 'unavailable';

      if (Number(budget.estado) === BUDGET_STATUS.ACTIVE) {
        await connection.execute<ResultSetHeader>(
          `UPDATE ${s.headerTable}
           SET ${s.headerStatusColumn} = ?
           WHERE ${s.headerId} = ? AND ${s.headerStatusColumn} = ?`,
          [BUDGET_STATUS.PRINTED, ppto, BUDGET_STATUS.ACTIVE],
        );
      }

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET tipo_ppto = CASE WHEN tipo_ppto IS NULL THEN ? ELSE tipo_ppto END,
             cobrado = (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?),
             faltante = GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0),
             id_estado = CASE
               WHEN id_estado <> ? AND GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0) = 0 THEN ?
               ELSE id_estado
             END,
             id_usuario_mod = ?,
             fecha_mod = NOW()
          WHERE id_orden = ?`,
        [tipo, orderId, orderId, COST_ORDER_STATUS.DOC_EQUIVALENTE, orderId, COST_ORDER_STATUS.FINALIZED, userId, orderId],
      );

      return { status: 'ok', associated: associatedCount };
      });
    } catch (error) {
      if (error instanceof CompensateRollbackError) return error.result;
      throw error;
    }
  }

  async reverseCompensateAssociation(orderId: number, associationId: number, userId: number): Promise<CompensateReverseResult> {
    const primaryKeyColumn = await this.getSysOcPptoPrimaryKeyColumn();
    if (!primaryKeyColumn) return 'identifier-unavailable';
    const primaryKey = this.quoteIdentifier(primaryKeyColumn);

    return this.db.transaction(async (connection: PoolConnection) => {
      const [orderRows] = await connection.execute<OrderLockRow[]>(
        `SELECT id_orden AS id, id_estado AS idEstado
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      const order = orderRows[0];
      if (!order) return 'not-found';
      if ([COST_ORDER_STATUS.PENDING, COST_ORDER_STATUS.CANCELED].includes(Number(order.idEstado) as 25 | 4)) return 'order-unavailable';

      const [linkRows] = await connection.execute<BudgetLinkLockRow[]>(
        `SELECT ${primaryKey} AS associationId,
                id_ppto AS idPpto,
                id_detalle_ppto AS idDetallePpto,
                id_detalle_orden AS idDetalleOrden,
                modulo,
                cobrado_item AS cobradoItem
         FROM sys_oc_ppto
         WHERE ${primaryKey} = ? AND id_orden = ?
         FOR UPDATE`,
        [associationId, orderId],
      );
      const link = linkRows[0];
      if (!link) return 'not-found';

      const s = BUDGET_STRUCTURES[Number(link.modulo)];
      if (!s) return 'budget-unavailable';
      const valueToReverse = this.round2(Number(link.cobradoItem ?? 0));

      const [budgetDetailRows] = await connection.execute<LockRow[]>(
        `SELECT ${s.detailId} AS id
         FROM ${s.detailTable}
         WHERE ${s.detailId} = ?
         FOR UPDATE`,
        [link.idDetallePpto],
      );
      if (budgetDetailRows.length !== 1) return 'budget-unavailable';

      const [orderDetailRows] = await connection.execute<DetailLockRow[]>(
        `SELECT id_detalle AS idDetalle
         FROM sys_detalle_costo
         WHERE id_orden = ? AND id_detalle = ?
         FOR UPDATE`,
        [orderId, link.idDetalleOrden],
      );
      if (orderDetailRows.length !== 1) return 'detail-unavailable';

      const [deleteResult] = await connection.execute<ResultSetHeader>(
        `DELETE FROM sys_oc_ppto WHERE ${primaryKey} = ? AND id_orden = ?`,
        [associationId, orderId],
      );
      if (deleteResult.affectedRows !== 1) return 'not-found';

      const [remainingBudgetLinks] = await connection.execute<CostOrderCountRow[]>(
        `SELECT COUNT(*) AS total
         FROM sys_oc_ppto
         WHERE modulo = ? AND id_detalle_ppto = ?`,
        [link.modulo, link.idDetallePpto],
      );
      const hasRemainingBudgetLinks = Number(remainingBudgetLinks[0]?.total ?? 0) > 0;

      await connection.execute<ResultSetHeader>(
        `UPDATE ${s.detailTable}
         SET valor_asignado_oc = GREATEST(COALESCE(valor_asignado_oc, 0) - ?, 0),
             ordcos_id = CASE WHEN ? = 1 THEN ordcos_id ELSE NULL END
         WHERE ${s.detailId} = ?`,
        [valueToReverse, hasRemainingBudgetLinks ? 1 : 0, link.idDetallePpto],
      );

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_detalle_costo
         SET total_cobrado = GREATEST(COALESCE(total_cobrado, 0) - ?, 0)
         WHERE id_orden = ? AND id_detalle = ?`,
        [valueToReverse, orderId, link.idDetalleOrden],
      );

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET cobrado = (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?),
             faltante = GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0),
             id_estado = CASE
               WHEN id_estado = ? AND GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0) > 0 THEN ?
               ELSE id_estado
             END,
             id_usuario_mod = ?,
             fecha_mod = NOW()
         WHERE id_orden = ?`,
        [orderId, orderId, COST_ORDER_STATUS.FINALIZED, orderId, COST_ORDER_STATUS.PRINTED, userId, orderId],
      );

      return 'ok';
    });
  }

  async budgetLinkExists(orderId: number, ppto: number, detailId: number): Promise<boolean> {
    const rows = await this.db.execute<CostOrderCountRow[]>(
      `SELECT COUNT(*) AS total FROM sys_oc_ppto WHERE id_orden = ? AND id_ppto = ? AND id_detalle_ppto = ?`,
      [orderId, ppto, detailId],
    );
    return Number(rows[0]?.total ?? 0) > 0;
  }

  async attachBudgetLine(
    orderId: number,
    userId: number,
    tipo: number,
    ppto: number,
    detailId: number,
    detalle: string,
    cantidad: number,
    asignado: number,
    expectedClientId: number,
    expectedProviderId: number,
  ): Promise<number | 'duplicate' | 'unavailable' | 'order-unavailable' | 'budget-unavailable'> {
    const s = BUDGET_STRUCTURES[tipo];
    const availableExpr = tipo === 7
      ? `(${s.totalExpr} / ((COALESCE((SELECT porcentaje_interna FROM sys_data_billing LIMIT 1), 0) / 100) + 1)) - COALESCE(d.valor_asignado_oc, 0)`
      : `${s.totalExpr} - COALESCE(d.valor_asignado_oc, 0)`;
    return this.db.transaction(async (connection: PoolConnection) => {
      const [orderRows] = await connection.execute<LockRow[]>(
        `SELECT id_orden AS id
         FROM sys_orden_costos
         WHERE id_orden = ? AND id_estado = 1 AND (tipo_ppto IS NULL OR tipo_ppto = ?)
         FOR UPDATE`,
        [orderId, tipo],
      );
      if (orderRows.length !== 1) return 'order-unavailable';

      // Bloquea la línea de presupuesto para evitar doble consumo concurrente.
      await connection.execute(
        `SELECT d.${s.detailId} FROM ${s.detailTable} d WHERE d.${s.detailId} = ? FOR UPDATE`,
        [detailId],
      );

      const budgetParams = tipo === 7
        ? [ppto, detailId, expectedClientId]
        : [ppto, detailId, expectedClientId, expectedProviderId];
      const providerCondition = tipo === 7 ? '' : `AND ${s.providerExpr} = ?`;
      const [budgetRows] = await connection.execute<CostOrderBudgetLineRow[]>(
        `SELECT d.${s.detailId} AS idDetalle, ${s.stateExpr} AS estado
         FROM ${s.headerTable} p
         INNER JOIN ${s.detailTable} d ON p.${s.headerId} = d.${s.detailJoinAlias}
         WHERE p.${s.headerId} = ?
           AND d.${s.detailId} = ?
           AND ${s.clientExpr} = ?
           ${providerCondition}
            AND ${s.stateExpr} NOT IN (${BUDGET_STATUS.CANCELED}, ${BUDGET_STATUS.CREDIT_NOTE})
          FOR UPDATE`,
        budgetParams,
      );
      if (budgetRows.length !== 1) return 'budget-unavailable';

      const [duplicateRows] = await connection.execute<CostOrderCountRow[]>(
        `SELECT COUNT(*) AS total FROM sys_oc_ppto WHERE id_orden = ? AND id_ppto = ? AND id_detalle_ppto = ?`,
        [orderId, ppto, detailId],
      );
      if (Number(duplicateRows[0]?.total ?? 0) > 0) return 'duplicate';

      const [budgetUpdate] = await connection.execute<ResultSetHeader>(
        `UPDATE ${s.detailTable} d
         SET valor_asignado_oc = COALESCE(d.valor_asignado_oc, 0) + ?
         WHERE d.${s.detailId} = ? AND (${availableExpr}) >= ?`,
        [asignado, detailId, asignado],
      );
      if (budgetUpdate.affectedRows !== 1) return 'unavailable';

      if (Number(budgetRows[0].estado) === BUDGET_STATUS.ACTIVE) {
        await connection.execute<ResultSetHeader>(
          `UPDATE ${s.headerTable}
           SET ${s.headerStatusColumn} = ?
           WHERE ${s.headerId} = ? AND ${s.headerStatusColumn} = ?`,
          [BUDGET_STATUS.PRINTED, ppto, BUDGET_STATUS.ACTIVE],
        );
      }

      const [detailResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO sys_detalle_costo (id_orden, detalle, valor, cantidad, total, total_cobrado)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, detalle, this.round2(asignado / cantidad), cantidad, asignado, asignado],
      );

      await connection.execute<ResultSetHeader>(
        `INSERT INTO sys_oc_ppto (id_orden, id_ppto, id_detalle_ppto, id_detalle_orden, modulo, cobrado_item)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, ppto, detailId, detailResult.insertId, tipo, asignado],
      );

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos o
         SET valor = (SELECT COALESCE(SUM(total), 0) FROM sys_detalle_costo WHERE id_orden = ?),
             tipo_ppto = ?,
             id_usuario_mod = ?,
             fecha_mod = NOW()
         WHERE o.id_orden = ?`,
        [orderId, tipo, userId, orderId],
      );

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET total = ((valor - (valor * (porc_descuento / 100))) + ((valor - (valor * (porc_descuento / 100))) * (porc_iva / 100))),
             cobrado = (SELECT COALESCE(SUM(cobrado_item), 0) FROM sys_oc_ppto WHERE id_orden = ?),
             faltante = GREATEST(valor - (SELECT COALESCE(SUM(cobrado_item), 0) FROM sys_oc_ppto WHERE id_orden = ?), 0)
         WHERE id_orden = ?`,
        [orderId, orderId, orderId],
      );
      return detailResult.insertId;
    });
  }

  async deleteDetail(orderId: number, detailId: number, userId: number): Promise<'ok' | 'order-unavailable' | 'not-found' | 'budget-unavailable'> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [orderRows] = await connection.execute<OrderLockRow[]>(
        `SELECT id_orden AS id, id_estado AS idEstado
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      if (orderRows.length !== 1) return 'not-found';
      if (Number(orderRows[0].idEstado) !== COST_ORDER_STATUS.ACTIVE) return 'order-unavailable';

      const [detailRows] = await connection.execute<DetailLockRow[]>(
        `SELECT id_detalle AS idDetalle
         FROM sys_detalle_costo
         WHERE id_orden = ? AND id_detalle = ?
         FOR UPDATE`,
        [orderId, detailId],
      );
      if (detailRows.length !== 1) return 'not-found';

      const [budgetLinks] = await connection.execute<BudgetLinkLockRow[]>(
        `SELECT id_ppto AS idPpto, id_detalle_ppto AS idDetallePpto, modulo, cobrado_item AS cobradoItem
         FROM sys_oc_ppto
         WHERE id_orden = ? AND id_detalle_orden = ?
         FOR UPDATE`,
        [orderId, detailId],
      );

      for (const link of budgetLinks) {
        const s = BUDGET_STRUCTURES[Number(link.modulo)];
        if (!s) return 'budget-unavailable';

        const [budgetDetailRows] = await connection.execute<LockRow[]>(
          `SELECT ${s.detailId} AS id
           FROM ${s.detailTable}
           WHERE ${s.detailId} = ?
           FOR UPDATE`,
          [link.idDetallePpto],
        );
        if (budgetDetailRows.length !== 1) return 'budget-unavailable';

        await connection.execute<ResultSetHeader>(
          `UPDATE ${s.detailTable}
           SET valor_asignado_oc = GREATEST(COALESCE(valor_asignado_oc, 0) - ?, 0)
           WHERE ${s.detailId} = ?`,
          [this.round2(Number(link.cobradoItem ?? 0)), link.idDetallePpto],
        );
      }

      await connection.execute<ResultSetHeader>(
        `DELETE FROM sys_oc_ppto WHERE id_orden = ? AND id_detalle_orden = ?`,
        [orderId, detailId],
      );
      await connection.execute<ResultSetHeader>(
        `DELETE FROM sys_detalle_costo WHERE id_orden = ? AND id_detalle = ?`,
        [orderId, detailId],
      );

      const [remainingBudgetRows] = await connection.execute<CostOrderCountRow[]>(
        `SELECT COUNT(*) AS total FROM sys_oc_ppto WHERE id_orden = ?`,
        [orderId],
      );
      const hasBudgetLinks = Number(remainingBudgetRows[0]?.total ?? 0) > 0;

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET valor = (SELECT COALESCE(SUM(total), 0) FROM sys_detalle_costo WHERE id_orden = ?),
             tipo_ppto = CASE WHEN ? = 1 THEN tipo_ppto ELSE NULL END,
             id_usuario_mod = ?,
             fecha_mod = NOW()
         WHERE id_orden = ?`,
        [orderId, hasBudgetLinks ? 1 : 0, userId, orderId],
      );

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET total = ((valor - (valor * (porc_descuento / 100))) + ((valor - (valor * (porc_descuento / 100))) * (porc_iva / 100))),
             cobrado = (SELECT COALESCE(SUM(cobrado_item), 0) FROM sys_oc_ppto WHERE id_orden = ?),
             faltante = GREATEST(valor - (SELECT COALESCE(SUM(cobrado_item), 0) FROM sys_oc_ppto WHERE id_orden = ?), 0)
         WHERE id_orden = ?`,
        [orderId, orderId, orderId],
      );

      return 'ok';
    });
  }

  async finalizeOrder(orderId: number, userId: number): Promise<'ok' | 'not-found' | 'already-finalized' | 'no-value' | 'negative-balance' | 'pending-balance'> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [rows] = await connection.execute<CostOrderFinalizeRow[]>(
        `SELECT id_orden AS id, id_estado AS idEstado, valor, faltante
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      if (rows.length !== 1) return 'not-found';

      const row = rows[0];
      const valor = Number(row.valor ?? 0);
      const faltante = Number(row.faltante ?? 0);

      if (Number(row.idEstado) === COST_ORDER_STATUS.FINALIZED) return 'already-finalized';
      if (valor <= 0) return 'no-value';
      if (faltante < 0) return 'negative-balance';
      if (faltante > 0) return 'pending-balance';

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET id_usuario_mod = ?, id_estado = ?, fecha_mod = NOW()
         WHERE id_orden = ?`,
        [userId, COST_ORDER_STATUS.FINALIZED, orderId],
      );

      return 'ok';
    });
  }

  async anuleOrder(orderId: number, userId: number): Promise<'ok' | 'not-found' | 'invalid-state' | 'has-budget-links' | 'has-radicado' | 'sequence-not-found'> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [orderRows] = await connection.execute<OrderLockRow[]>(
        `SELECT id_orden AS id, id_estado AS idEstado
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      if (orderRows.length !== 1) return 'not-found';
      if (![COST_ORDER_STATUS.ACTIVE, COST_ORDER_STATUS.PRINTED].includes(Number(orderRows[0].idEstado) as 1 | 27)) return 'invalid-state';

      const [budgetRows] = await connection.execute<LockRow[]>(
        `SELECT id_orden AS id
         FROM sys_oc_ppto
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      if (budgetRows.length > 0) return 'has-budget-links';

      const [radicadoRows] = await connection.execute<LockRow[]>(
        `SELECT id_detalle AS id
         FROM sys_radicado_detalle
         WHERE orden = ? AND tipo = 'costo'
         FOR UPDATE`,
        [orderId],
      );
      if (radicadoRows.length > 0) return 'has-radicado';

      const [sequenceRows] = await connection.execute<(RowDataPacket & { consecutivo: number | null })[]>(
        `SELECT consecutivo
         FROM sys_consecutivos
         WHERE tipo = 'anulacion_oc'
         FOR UPDATE`,
      );
      if (sequenceRows.length !== 1) return 'sequence-not-found';
      const next = Number(sequenceRows[0].consecutivo ?? 0) + 1;

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET id_estado = ?, fecha_anulacion = CURDATE(), consecutivo_anulacion = ?, id_usuario_mod = ?, fecha_mod = NOW()
         WHERE id_orden = ?`,
        [COST_ORDER_STATUS.CANCELED, next, userId, orderId],
      );
      await connection.execute<ResultSetHeader>(
        `UPDATE sys_consecutivos
         SET consecutivo = ?
         WHERE tipo = 'anulacion_oc'`,
        [next],
      );

      return 'ok';
    });
  }

  async replaceOrder(orderId: number, userId: number): Promise<{ id: number } | 'not-found' | 'invalid-state' | 'has-radicado' | 'no-budget-links' | 'invalid-budget-links'> {
    try {
      return await this.db.transaction(async (connection: PoolConnection) => {
      const [headerRows] = await connection.execute<CostOrderReplacementHeaderRow[]>(
        `SELECT
          id_orden AS id,
          id_estado AS idEstado,
          id_cliente AS idCliente,
          id_proveedor AS idProveedor,
          id_campana AS idCampana,
          id_producto AS idProducto,
          id_servicio AS idServicio,
          tipo,
          observacion,
          porc_iva AS porcIva,
          porc_descuento AS porcDescuento,
          valor,
          total,
          cobrado,
          faltante
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      const header = headerRows[0];
      if (!header) return 'not-found';
      if (![COST_ORDER_STATUS.FINALIZED, COST_ORDER_STATUS.PRINTED].includes(Number(header.idEstado) as 8 | 27)) return 'invalid-state';

      const [radicadoRows] = await connection.execute<LockRow[]>(
        `SELECT id_detalle AS id
         FROM sys_radicado_detalle
         WHERE orden = ? AND tipo = 'costo'
         FOR UPDATE`,
        [orderId],
      );
      if (radicadoRows.length > 0) return 'has-radicado';

      const [budgetLinks] = await connection.execute<CostOrderBudgetLinkRow[]>(
        `SELECT id_ppto AS idPpto, id_detalle_ppto AS idDetallePpto, id_detalle_orden AS idDetalleOrden, modulo, cobrado_item AS cobradoItem
         FROM sys_oc_ppto
         WHERE id_orden = ?
         FOR UPDATE`,
        [orderId],
      );
      if (budgetLinks.length === 0) return 'no-budget-links';
      const linkBudgetTypes = budgetLinks.map((link) => Number(link.modulo));
      if (linkBudgetTypes.some((modulo) => !Number.isInteger(modulo) || modulo <= 0)) return 'invalid-budget-links';
      const budgetTypes = new Set(linkBudgetTypes);
      if (budgetTypes.size !== 1) return 'invalid-budget-links';
      const replacementBudgetType = [...budgetTypes][0];

      const [details] = await connection.execute<CostOrderReplacementDetailRow[]>(
        `SELECT id_detalle AS idDetalle, detalle, cantidad, valor, total, total_cobrado AS totalCobrado
         FROM sys_detalle_costo
         WHERE id_orden = ?
         ORDER BY id_detalle
         FOR UPDATE`,
        [orderId],
      );
      const detailIds = new Set(details.map((detail) => Number(detail.idDetalle)));
      if (budgetLinks.some((link) => !link.idDetalleOrden || !detailIds.has(Number(link.idDetalleOrden)))) return 'invalid-budget-links';

      const oldObservation = (header.observacion || '').trim();
      const observation = oldObservation
        ? `Reemplazo de la orden No-${orderId} - ${oldObservation}`
        : `Reemplazo de la orden No-${orderId}`;

      const [headerResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO sys_orden_costos
          (fecha, id_cliente, id_proveedor, id_producto, id_campana, id_servicio,
           id_estado, id_usuario, id_usuario_mod, tipo, observacion, obs_final,
           porc_iva, porc_descuento, valor, total, cobrado, faltante, num_impresiones,
           docequi, notas, tipo_ppto, id_cotizacion, reemplazo, fecha_anulacion, consecutivo_anulacion)
           VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, -1, 0, 0, ?, NULL, NULL, NULL, NULL)`,
        [
          header.idCliente,
          header.idProveedor,
          header.idProducto,
          header.idCampana,
          header.idServicio,
          COST_ORDER_STATUS.ACTIVE,
          userId,
          userId,
          header.tipo,
          observation,
          Number(header.porcIva ?? 0),
          Number(header.porcDescuento ?? 0),
          Number(header.valor ?? 0),
          Number(header.total ?? 0),
          Number(header.cobrado ?? 0),
          Number(header.faltante ?? 0),
          replacementBudgetType,
        ],
      );
      const newOrderId = headerResult.insertId;

      const detailMap = new Map<number, number>();
      for (const detail of details) {
        const [detailResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO sys_detalle_costo (id_orden, detalle, valor, cantidad, total, total_cobrado, reemplazo)
           VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [
            newOrderId,
            detail.detalle,
            Number(detail.valor ?? 0),
            Number(detail.cantidad ?? 0),
            Number(detail.total ?? 0),
            Number(detail.totalCobrado ?? 0),
          ],
        );
        detailMap.set(Number(detail.idDetalle), detailResult.insertId);
      }

      for (const [oldDetailId, newDetailId] of detailMap.entries()) {
        await connection.execute<ResultSetHeader>(
          `UPDATE sys_oc_ppto
           SET id_orden = ?, id_detalle_orden = ?
           WHERE id_orden = ? AND id_detalle_orden = ?`,
          [newOrderId, newDetailId, orderId, oldDetailId],
        );
      }

      const [remainingBudgetRows] = await connection.execute<CostOrderCountRow[]>(
        `SELECT COUNT(*) AS total
         FROM sys_oc_ppto
         WHERE id_orden = ?`,
        [orderId],
      );
      if (Number(remainingBudgetRows[0]?.total ?? 0) > 0) throw new Error(REPLACE_INVALID_BUDGET_LINKS);

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos
         SET id_estado = ?, cobrado = 0, faltante = 0, id_usuario_mod = ?, fecha_mod = NOW()
         WHERE id_orden = ?`,
        [COST_ORDER_STATUS.CANCELED, userId, orderId],
      );

      return { id: newOrderId };
      });
    } catch (error) {
      if (error instanceof Error && error.message === REPLACE_INVALID_BUDGET_LINKS) return 'invalid-budget-links';
      throw error;
    }
  }

  async duplicateOrders(sourceIds: number[], userId: number): Promise<{ createdIds: number[] } | 'invalid-source'> {
    const placeholders = sourceIds.map(() => '?').join(', ');

    return this.db.transaction(async (connection: PoolConnection) => {
      const [headers] = await connection.execute<CostOrderDuplicateHeaderRow[]>(
        `SELECT
          id_orden AS id,
          id_cliente AS idCliente,
          id_proveedor AS idProveedor,
          id_campana AS idCampana,
          id_producto AS idProducto,
          id_servicio AS idServicio,
          tipo,
          observacion,
          porc_iva AS porcIva,
          porc_descuento AS porcDescuento,
          valor,
          total
         FROM sys_orden_costos
         WHERE id_orden IN (${placeholders})
           AND fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
           AND fecha < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
         FOR UPDATE`,
        sourceIds,
      );

      if (headers.length !== sourceIds.length) return 'invalid-source';
      const headersById = new Map(headers.map((header) => [Number(header.id), header]));
      if (sourceIds.some((id) => !headersById.has(id))) return 'invalid-source';

      const [details] = await connection.execute<CostOrderDetailRow[]>(
        `SELECT id_orden AS idOrden, id_detalle AS idDetalle, detalle, cantidad, valor, total, 0 AS hasBudget, NULL AS budgetTipo, NULL AS budgetPpto, NULL AS budgetIdDetallePpto, NULL AS budgetValorAsignado
         FROM sys_detalle_costo
         WHERE id_orden IN (${placeholders})
         ORDER BY id_orden, id_detalle
         FOR UPDATE`,
        sourceIds,
      );
      const detailsByOrder = new Map<number, CostOrderDetailRow[]>();
      for (const detail of details) {
        const orderId = Number((detail as CostOrderDetailRow & { idOrden: number }).idOrden);
        detailsByOrder.set(orderId, [...(detailsByOrder.get(orderId) || []), detail]);
      }

      const createdIds: number[] = [];
      const today = new Date().toISOString().slice(0, 10);

      for (const sourceId of sourceIds) {
        const header = headersById.get(sourceId);
        if (!header) return 'invalid-source';
        const sourceDetails = detailsByOrder.get(sourceId) || [];
        const oldObservation = (header.observacion || '').trim();
        const observation = oldObservation
          ? `Duplicado de la orden No-${sourceId} - ${oldObservation}`
          : `Duplicado de la orden No-${sourceId}`;

        const [headerResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO sys_orden_costos
            (fecha, id_cliente, id_proveedor, id_producto, id_campana, id_servicio,
             id_estado, id_usuario, id_usuario_mod, tipo, observacion,
             porc_iva, porc_descuento, valor, total, cobrado, faltante, num_impresiones,
             docequi, notas, tipo_ppto, id_cotizacion, reemplazo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, -1, 0, 0, NULL, NULL, NULL)`,
          [
            today,
            header.idCliente,
            header.idProveedor,
            header.idProducto,
            header.idCampana,
            header.idServicio,
            COST_ORDER_STATUS.ACTIVE,
            userId,
            userId,
            header.tipo,
            observation,
            Number(header.porcIva ?? 0),
            Number(header.porcDescuento ?? 0),
            Number(header.valor ?? 0),
            Number(header.total ?? 0),
            Number(header.valor ?? 0),
          ],
        );
        const newOrderId = headerResult.insertId;
        createdIds.push(newOrderId);

        if (sourceDetails.length > 0) {
          const detailPlaceholders = sourceDetails.map(() => '(?, ?, ?, ?, ?)').join(', ');
          const detailParams: (string | number)[] = [];
          for (const detail of sourceDetails) {
            detailParams.push(newOrderId, detail.detalle, Number(detail.valor ?? 0), Number(detail.cantidad ?? 0), Number(detail.total ?? 0));
          }
          await connection.execute<ResultSetHeader>(
            `INSERT INTO sys_detalle_costo (id_orden, detalle, valor, cantidad, total) VALUES ${detailPlaceholders}`,
            detailParams,
          );
        }
      }

      return { createdIds };
    });
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  // Actualiza cabecera + reemplaza líneas de detalle NO vinculadas a presupuesto, en una
  // transacción. Las líneas con sys_oc_ppto NO se tocan (se preservan para la Fase 2).
  async updateOrder(
    id: number,
    header: {
      idCliente: number; idProveedor: number; idProducto: number; idCampana: number;
      idServicio: number; observacion: string | null; porcIva: number; porcDescuento: number;
      idUsuario: number;
    },
    details: NewCostOrderDetail[],
    blockOwnerChangeWithBudgetLinks = false,
  ): Promise<'ok' | 'owner-change-blocked' | 'not-found' | 'order-unavailable'> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [orderRows] = await connection.execute<CostOrderHeaderRow[]>(
        `SELECT id_orden AS id, id_estado AS idEstado, id_cliente AS idCliente, id_proveedor AS idProveedor
         FROM sys_orden_costos
         WHERE id_orden = ?
         FOR UPDATE`,
        [id],
      );
      const order = orderRows[0];
      if (!order) return 'not-found';
      if (Number(order.idEstado) !== COST_ORDER_STATUS.ACTIVE) return 'order-unavailable';

      const ownerChanged = Number(order.idCliente) !== header.idCliente || Number(order.idProveedor) !== header.idProveedor;
      if (blockOwnerChangeWithBudgetLinks && ownerChanged) {
        const [linkRows] = await connection.execute<CostOrderCountRow[]>(
          `SELECT COUNT(*) AS total
           FROM sys_oc_ppto
           WHERE id_orden = ?`,
          [id],
        );
        if (Number(linkRows[0]?.total ?? 0) > 0) return 'owner-change-blocked';
      }

      // Borra solo las líneas SIN presupuesto (preserva las vinculadas).
      await connection.execute(
        `DELETE d FROM sys_detalle_costo d
         LEFT JOIN sys_oc_ppto p ON p.id_detalle_orden = d.id_detalle
         WHERE d.id_orden = ? AND p.id_orden IS NULL`,
        [id],
      );

      if (details.length > 0) {
        const placeholders = details.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const params: (string | number)[] = [];
        for (const d of details) {
          params.push(id, d.detalle, d.cantidad, d.valor, d.total);
        }
        await connection.execute<ResultSetHeader>(
          `INSERT INTO sys_detalle_costo (id_orden, detalle, cantidad, valor, total) VALUES ${placeholders}`,
          params,
        );
      }

      const [budgetRows] = await connection.execute<CostOrderCountRow[]>(
        `SELECT COALESCE(SUM(d.total), 0) AS total
         FROM sys_detalle_costo d
         INNER JOIN sys_oc_ppto p ON p.id_detalle_orden = d.id_detalle
         WHERE d.id_orden = ?`,
        [id],
      );
      const budgetTotal = Number(budgetRows[0]?.total ?? 0);
      const manualTotal = details.reduce((sum, d) => sum + d.total, 0);
      const valor = this.round2(budgetTotal + manualTotal);
      const descuento = valor * (header.porcDescuento / 100);
      const iva = (valor - descuento) * (header.porcIva / 100);
      const total = this.round2(valor - descuento + iva);

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos SET
          id_cliente = ?, id_proveedor = ?, id_producto = ?, id_campana = ?,
          id_servicio = ?, observacion = ?, porc_iva = ?, porc_descuento = ?,
          valor = ?, total = ?, faltante = valor - cobrado, id_usuario_mod = ?, fecha_mod = NOW()
        WHERE id_orden = ?`,
        [
          header.idCliente, header.idProveedor, header.idProducto, header.idCampana,
          header.idServicio, header.observacion, header.porcIva, header.porcDescuento,
          valor, total, header.idUsuario, id,
        ],
      );
      return 'ok';
    });
  }

  // Inserta cabecera + detalles manuales/presupuesto en una transacción y devuelve el id de la nueva orden.
  async createOrder(
    header: NewCostOrderHeader,
    details: NewCostOrderDetail[],
    budgetDetails: { tipo: number; ppto: number; idDetallePpto: number; detalle: string; cantidad: number; valorAsignado: number }[] = [],
  ): Promise<CreateOrderResult> {
    if (budgetDetails.some((item) => item.tipo !== budgetDetails[0]?.tipo)) return 'budget-type-mismatch';

    try {
      return await this.db.transaction(async (connection: PoolConnection) => {
        const budgetRowsToInsert: { tipo: number; ppto: number; idDetallePpto: number; detalle: string; cantidad: number; valorAsignado: number; estado: number | null; availableExpr: string; detailTable: string; detailId: string; headerTable: string; headerId: string; headerStatusColumn: string }[] = [];
        const requestedByBudgetDetail = new Map<string, number>();

        for (const item of budgetDetails) {
        const s = BUDGET_STRUCTURES[item.tipo];
        if (!s) return 'budget-unavailable';
        const availableExpr = item.tipo === 7
          ? `(${s.totalExpr} / ((COALESCE((SELECT porcentaje_interna FROM sys_data_billing LIMIT 1), 0) / 100) + 1)) - COALESCE(d.valor_asignado_oc, 0)`
          : `${s.totalExpr} - COALESCE(d.valor_asignado_oc, 0)`;
        const providerCondition = item.tipo === 7 ? '' : `AND ${s.providerExpr} = ?`;
        const budgetParams = item.tipo === 7
          ? [item.ppto, header.idCliente]
          : [item.ppto, header.idCliente, header.idProveedor];

        const [budgetHeaderRows] = await connection.execute<(RowDataPacket & { id: number; estado: number | null })[]>(
          `SELECT p.${s.headerId} AS id, ${s.stateExpr} AS estado
           FROM ${s.headerTable} p
           WHERE p.${s.headerId} = ?
             AND ${s.clientExpr} = ?
             ${providerCondition}
             AND ${s.stateExpr} NOT IN (${BUDGET_STATUS.CANCELED}, ${BUDGET_STATUS.CREDIT_NOTE})
           FOR UPDATE`,
          budgetParams,
        );
        const budgetHeader = budgetHeaderRows[0];
        if (!budgetHeader) return 'budget-unavailable';

        const [budgetDetailRows] = await connection.execute<(RowDataPacket & { idDetalle: number; disponible: number })[]>(
          `SELECT d.${s.detailId} AS idDetalle, ${availableExpr} AS disponible
           FROM ${s.headerTable} p
           INNER JOIN ${s.detailTable} d ON p.${s.headerId} = d.${s.detailJoinAlias}
           WHERE p.${s.headerId} = ? AND d.${s.detailId} = ?
           FOR UPDATE`,
          [item.ppto, item.idDetallePpto],
        );
        const budgetDetail = budgetDetailRows[0];
        if (!budgetDetail) return 'budget-unavailable';

        const key = `${item.tipo}:${item.ppto}:${item.idDetallePpto}`;
        const requested = this.round2((requestedByBudgetDetail.get(key) ?? 0) + item.valorAsignado);
        requestedByBudgetDetail.set(key, requested);
        if (Number(budgetDetail.disponible ?? 0) + 0.0001 < requested) return 'unavailable';

        budgetRowsToInsert.push({
          ...item,
          estado: budgetHeader.estado,
          availableExpr,
          detailTable: s.detailTable,
          detailId: s.detailId,
          headerTable: s.headerTable,
          headerId: s.headerId,
          headerStatusColumn: s.headerStatusColumn,
        });
      }

        const [headerResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO sys_orden_costos
          (fecha, id_cliente, id_proveedor, id_producto, id_campana, id_servicio,
           id_estado, id_usuario, id_usuario_mod, tipo, observacion,
           porc_iva, porc_descuento, valor, total, cobrado, faltante, num_impresiones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, -1)`,
        [
          header.fecha, header.idCliente, header.idProveedor, header.idProducto,
          header.idCampana, header.idServicio, header.idEstado, header.idUsuario,
          header.idUsuario, header.tipo, header.observacion,
          header.porcIva, header.porcDescuento, header.valor, header.total, header.valor,
        ],
      );
        const orderId = headerResult.insertId;

        if (details.length > 0) {
        const placeholders = details.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const params: (string | number)[] = [];
        for (const d of details) {
          params.push(orderId, d.detalle, d.cantidad, d.valor, d.total);
        }
        await connection.execute<ResultSetHeader>(
          `INSERT INTO sys_detalle_costo (id_orden, detalle, cantidad, valor, total) VALUES ${placeholders}`,
          params,
        );
      }

        for (const item of budgetRowsToInsert) {
        const [budgetUpdate] = await connection.execute<ResultSetHeader>(
          `UPDATE ${item.detailTable} d
           SET valor_asignado_oc = COALESCE(d.valor_asignado_oc, 0) + ?,
               ordcos_id = ?
           WHERE d.${item.detailId} = ? AND (${item.availableExpr}) >= ?`,
          [item.valorAsignado, orderId, item.idDetallePpto, item.valorAsignado],
        );
        if (budgetUpdate.affectedRows !== 1) throw new CreateOrderRollbackError('unavailable');

        if (Number(item.estado) === BUDGET_STATUS.ACTIVE) {
          await connection.execute<ResultSetHeader>(
            `UPDATE ${item.headerTable}
             SET ${item.headerStatusColumn} = ?
             WHERE ${item.headerId} = ? AND ${item.headerStatusColumn} = ?`,
            [BUDGET_STATUS.PRINTED, item.ppto, BUDGET_STATUS.ACTIVE],
          );
        }

        const [detailResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO sys_detalle_costo (id_orden, detalle, cantidad, valor, total, total_cobrado)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, item.detalle, item.cantidad, this.round2(item.valorAsignado / item.cantidad), item.valorAsignado, item.valorAsignado],
        );

        await connection.execute<ResultSetHeader>(
          `INSERT INTO sys_oc_ppto (id_orden, id_ppto, id_detalle_ppto, id_detalle_orden, modulo, cobrado_item)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, item.ppto, item.idDetallePpto, detailResult.insertId, item.tipo, item.valorAsignado],
        );
      }

        if (budgetRowsToInsert.length > 0) {
        await connection.execute<ResultSetHeader>(
          `UPDATE sys_orden_costos
           SET tipo_ppto = ?,
               cobrado = (SELECT COALESCE(SUM(cobrado_item), 0) FROM sys_oc_ppto WHERE id_orden = ?),
               faltante = GREATEST(valor - (SELECT COALESCE(SUM(cobrado_item), 0) FROM sys_oc_ppto WHERE id_orden = ?), 0),
               id_usuario_mod = ?,
               fecha_mod = NOW()
           WHERE id_orden = ?`,
          [budgetRowsToInsert[0].tipo, orderId, orderId, header.idUsuario, orderId],
        );
      }

        return orderId;
      });
    } catch (error) {
      if (error instanceof CreateOrderRollbackError) return error.result;
      throw error;
    }
  }
}
