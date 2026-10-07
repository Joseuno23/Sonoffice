import { Injectable } from '@nestjs/common';
import { ResultSetHeader } from 'mysql2';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { DbService } from '../db/db.service';
import { CountRow, DefaultsRow, ExpenseOrderDetailRow, ExpenseOrderHeaderRow, ExpenseOrderRow, OptionRow, SequenceRow } from './expense-orders.types';

export const EXPENSE_ORDER_STATUS = { ACTIVE: 1, PRINTED: 5, LOCKED: 39, CANCELED: 9999 } as const;

export interface ExpenseOrderFilters { search: string | null; proveedor: number | null; fechaIni: string | null; fechaFin: string | null; }

export interface NormalizedExpenseOrderPayload {
  idProveedor: number; idServicio?: number | null; observacion: string | null; descuento: number; iva: number;
  details: { idDetalle?: number; detalle: string; cantidad: number; valor: number }[];
}

const FROM_JOINS = `
  FROM ord_gastos o
  LEFT JOIN cat_estados e ON o.ordgas_estado = e.est_id
  LEFT JOIN sys_clients p ON o.pvcl_id = p.id_client
  LEFT JOIN usuarios u ON o.usr_id = u.usr_id
  LEFT JOIN sys_tipo_servicio s ON o.tpsv_id = s.id_tipo_servicio
`;

@Injectable()
export class ExpenseOrdersRepository {
  constructor(private readonly db: DbService) {}

  private buildWhere(filters: ExpenseOrderFilters): { clause: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (filters.search) {
      const like = `%${filters.search}%`;
      conditions.push('(o.ordgas_id LIKE ? OR p.nombre LIKE ? OR CONCAT(COALESCE(u.usr_nombre, ""), " ", COALESCE(u.usr_apellido, "")) LIKE ? OR e.est_nombre LIKE ? OR o.ordgas_total LIKE ?)');
      params.push(like, like, like, like, like);
    }
    if (filters.proveedor) { conditions.push('o.pvcl_id = ?'); params.push(filters.proveedor); }
    if (filters.fechaIni && filters.fechaFin) { conditions.push('o.ordgas_fecha BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)'); params.push(filters.fechaIni, filters.fechaFin); }
    return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
  }

  async findOrders(filters: ExpenseOrderFilters, limit: number, offset: number): Promise<ExpenseOrderRow[]> {
    const { clause, params } = this.buildWhere(filters);
    return this.db.execute<ExpenseOrderRow[]>(`
      SELECT o.ordgas_id AS id, o.ordgas_fecha AS fecha, e.est_nombre AS estado, e.est_color AS estadoColor, e.est_id AS idEstado,
             p.nombre AS proveedor, p.documento AS proveedorDocumento, CONCAT(COALESCE(u.usr_nombre, ''), ' ', COALESCE(u.usr_apellido, '')) AS usuario,
             s.nombre AS servicio, o.ordgas_valor AS valor, o.ordgas_total AS total, o.num_impresiones AS numImpresiones,
             o.aprobada, o.recurrente
      ${FROM_JOINS}
      ${clause}
      ORDER BY o.ordgas_id DESC
      LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
  }

  async countOrders(filters: ExpenseOrderFilters): Promise<number> {
    const { clause, params } = this.buildWhere(filters);
    const rows = await this.db.execute<CountRow[]>(`SELECT COUNT(*) AS total ${FROM_JOINS} ${clause}`, params);
    return Number(rows[0]?.total ?? 0);
  }

  async findStatuses(): Promise<OptionRow[]> {
    return this.db.execute<OptionRow[]>(`
      SELECT DISTINCT e.est_id AS id, e.est_nombre AS label
      FROM ord_gastos o INNER JOIN cat_estados e ON o.ordgas_estado = e.est_id
      WHERE e.est_nombre IS NOT NULL AND TRIM(e.est_nombre) <> ''
      ORDER BY e.est_nombre`);
  }

  async findProviders(search: string | null, limit: number): Promise<OptionRow[]> {
    const params: (string | number)[] = [];
    let where = 'WHERE proveedor = 1 AND id_status = 1';
    if (search) { where += ' AND nombre LIKE ?'; params.push(`%${search}%`); }
    return this.db.execute<OptionRow[]>(`SELECT id_client AS id, nombre AS label FROM sys_clients ${where} ORDER BY nombre LIMIT ${Number(limit)}`, params);
  }

  async findDefaults(): Promise<DefaultsRow | null> {
    const rows = await this.db.execute<DefaultsRow[]>(`SELECT iva FROM sys_data_billing LIMIT 1`);
    return rows[0] ?? null;
  }

  async findLegacyUserId(userId: number): Promise<number | null> {
    const rows = await this.db.execute<(RowDataPacket & { legacyUserId: number | null })[]>(`SELECT id_users_medios AS legacyUserId FROM sys_users WHERE id_users = ? LIMIT 1`, [userId]);
    return rows[0]?.legacyUserId === null || rows[0]?.legacyUserId === undefined ? null : Number(rows[0].legacyUserId);
  }

  async findOrderById(id: number): Promise<ExpenseOrderHeaderRow | null> {
    const rows = await this.db.execute<ExpenseOrderHeaderRow[]>(`
      SELECT o.ordgas_id AS id, o.ordgas_fecha AS fecha, e.est_nombre AS estado, e.est_color AS estadoColor, e.est_id AS idEstado,
             o.pvcl_id AS idProveedor, p.nombre AS proveedor, p.documento AS proveedorDocumento,
             CONCAT(COALESCE(u.usr_nombre, ''), ' ', COALESCE(u.usr_apellido, '')) AS usuario,
             o.tpsv_id AS idServicio, s.nombre AS servicio, o.ordgas_observa AS observacion,
             o.ordgas_desc AS descuento, o.ordgas_iva AS iva, o.ordgas_valor AS valor, o.ordgas_total AS total,
             o.num_impresiones AS numImpresiones, o.aprobada, o.recurrente, o.inicio_recurrencia AS inicioRecurrencia,
             o.fin_recurrencia AS finRecurrencia, o.fecha_anulacion AS fechaAnulacion, o.consecutivo_anulacion AS consecutivoAnulacion
      ${FROM_JOINS}
      WHERE o.ordgas_id = ?
      LIMIT 1`, [id]);
    return rows[0] ?? null;
  }

  async findDetails(id: number): Promise<ExpenseOrderDetailRow[]> {
    return this.db.execute<ExpenseOrderDetailRow[]>(`
      SELECT dordgas_id AS idDetalle, dordgas_detalle AS detalle, COALESCE(dordgas_cant, 1) AS cantidad, dordgas_valor AS valor
      FROM det_ordgasto WHERE ordgas_id = ? ORDER BY dordgas_id`, [id]);
  }

  async createOrder(userId: number, payload: NormalizedExpenseOrderPayload): Promise<number> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const totals = this.calculateTotals(payload);
      const serviceColumns = payload.idServicio === undefined ? '' : ', tpsv_id';
      const servicePlaceholders = payload.idServicio === undefined ? '' : ', ?';
      const serviceParams = payload.idServicio === undefined ? [] : [payload.idServicio];
      const [result] = await connection.execute<ResultSetHeader>(`
        INSERT INTO ord_gastos (ordgas_fecha, ordgas_estado, ordgas_valor, ordgas_total, pvcl_id, usr_id${serviceColumns}, ordgas_observa, ordgas_desc, ordgas_iva, ordgas_usuariomod, num_impresiones, aprobada, recurrente)
        VALUES (CURDATE(), ?, ?, ?, ?, ?${servicePlaceholders}, ?, ?, ?, ?, -1, 0, 0)`,
        [EXPENSE_ORDER_STATUS.ACTIVE, totals.valor, totals.total, payload.idProveedor, userId, ...serviceParams, payload.observacion, payload.descuento, payload.iva, userId],
      );
      for (const detail of payload.details) {
        await connection.execute<ResultSetHeader>(`INSERT INTO det_ordgasto (ordgas_id, tpsrv_id, dordgas_detalle, dordgas_cant, dordgas_valor) VALUES (?, ?, ?, ?, ?)`, [result.insertId, payload.idServicio ?? 0, detail.detalle, detail.cantidad, detail.valor]);
      }
      return result.insertId;
    });
  }

  async updateOrder(id: number, userId: number, payload: NormalizedExpenseOrderPayload): Promise<'ok' | 'not-found' | 'invalid-state' | 'not-editable'> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number; approved: number | null; printCount: number | null })[]>(`SELECT ordgas_estado AS state, aprobada AS approved, num_impresiones AS printCount FROM ord_gastos WHERE ordgas_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      if (Number(rows[0].state) !== EXPENSE_ORDER_STATUS.ACTIVE) return 'invalid-state';
      if (Number(rows[0].approved ?? 0) === 1 || Number(rows[0].printCount ?? -1) !== -1) return 'not-editable';
      const totals = this.calculateTotals(payload);
      const serviceUpdate = payload.idServicio === undefined ? '' : ', tpsv_id = ?';
      const serviceParams = payload.idServicio === undefined ? [] : [payload.idServicio];
      await connection.execute<ResultSetHeader>(`UPDATE ord_gastos SET pvcl_id = ?${serviceUpdate}, ordgas_observa = ?, ordgas_desc = ?, ordgas_iva = ?, ordgas_valor = ?, ordgas_total = ?, ordgas_usuariomod = ? WHERE ordgas_id = ?`, [payload.idProveedor, ...serviceParams, payload.observacion, payload.descuento, payload.iva, totals.valor, totals.total, userId, id]);
      await connection.execute<ResultSetHeader>(`DELETE FROM det_ordgasto WHERE ordgas_id = ?`, [id]);
      for (const detail of payload.details) {
        await connection.execute<ResultSetHeader>(`INSERT INTO det_ordgasto (ordgas_id, tpsrv_id, dordgas_detalle, dordgas_cant, dordgas_valor) VALUES (?, ?, ?, ?, ?)`, [id, payload.idServicio ?? 0, detail.detalle, detail.cantidad, detail.valor]);
      }
      return 'ok';
    });
  }

  async markPrinted(id: number, userId: number): Promise<'ok' | 'not-found'> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number })[]>(`SELECT ordgas_estado AS state FROM ord_gastos WHERE ordgas_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      await connection.execute<ResultSetHeader>(`UPDATE ord_gastos SET ordgas_estado = CASE WHEN ordgas_estado <> ? THEN ? ELSE ordgas_estado END, num_impresiones = COALESCE(num_impresiones, -1) + 1, ordgas_usuariomod = ? WHERE ordgas_id = ?`, [EXPENSE_ORDER_STATUS.CANCELED, EXPENSE_ORDER_STATUS.PRINTED, userId, id]);
      return 'ok';
    });
  }

  async approve(id: number): Promise<'ok' | 'not-found' | 'canceled'> {
    const result = await this.db.execute<ResultSetHeader>(`UPDATE ord_gastos SET aprobada = 1 WHERE ordgas_id = ? AND ordgas_estado <> ?`, [id, EXPENSE_ORDER_STATUS.CANCELED]);
    if (result.affectedRows === 1) return 'ok';
    const current = await this.findOrderById(id);
    return current ? 'canceled' : 'not-found';
  }

  async approveBulk(ids: number[]): Promise<number> {
    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    if (uniqueIds.length === 0) return 0;
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const result = await this.db.execute<ResultSetHeader>(
      `UPDATE ord_gastos SET aprobada = 1 WHERE ordgas_id IN (${placeholders}) AND ordgas_estado <> ?`,
      [...uniqueIds, EXPENSE_ORDER_STATUS.CANCELED],
    );
    return Number(result.affectedRows ?? 0);
  }

  async anule(id: number, userId: number): Promise<'ok' | 'not-found' | 'already-canceled' | 'invalid-state' | 'sequence-not-found'> {
    return this.db.transaction(async (connection: PoolConnection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number })[]>(`SELECT ordgas_estado AS state FROM ord_gastos WHERE ordgas_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      const state = Number(rows[0].state);
      if (state === EXPENSE_ORDER_STATUS.CANCELED) return 'already-canceled';
      if (state === EXPENSE_ORDER_STATUS.LOCKED) return 'invalid-state';
      const [sequenceRows] = await connection.execute<SequenceRow[]>(`SELECT consecutivo FROM sys_consecutivos WHERE tipo = 'anulacion_og' FOR UPDATE`);
      if (!sequenceRows[0]) return 'sequence-not-found';
      const next = Number(sequenceRows[0].consecutivo ?? 0) + 1;
      await connection.execute<ResultSetHeader>(`UPDATE ord_gastos SET ordgas_estado = ?, fecha_anulacion = CURDATE(), consecutivo_anulacion = ?, ordgas_usuariomod = ? WHERE ordgas_id = ?`, [EXPENSE_ORDER_STATUS.CANCELED, next, userId, id]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_consecutivos SET consecutivo = ? WHERE tipo = 'anulacion_og'`, [next]);
      return 'ok';
    });
  }

  async setRecurrence(id: number, inicio: string, fin: string): Promise<'ok' | 'not-found'> {
    const result = await this.db.execute<ResultSetHeader>(`UPDATE ord_gastos SET inicio_recurrencia = ?, fin_recurrencia = ?, recurrente = 1 WHERE ordgas_id = ?`, [inicio, fin, id]);
    return result.affectedRows === 1 ? 'ok' : 'not-found';
  }

  async clearRecurrence(id: number): Promise<'ok' | 'not-found'> {
    const result = await this.db.execute<ResultSetHeader>(`UPDATE ord_gastos SET inicio_recurrencia = NULL, fin_recurrencia = NULL, recurrente = 0 WHERE ordgas_id = ?`, [id]);
    return result.affectedRows === 1 ? 'ok' : 'not-found';
  }

  private calculateTotals(payload: NormalizedExpenseOrderPayload) {
    const valor = this.round2(payload.details.reduce((sum, detail) => sum + detail.valor, 0));
    const descuento = this.round2(valor * (payload.descuento / 100));
    const subtotal = this.round2(valor - descuento);
    const total = this.round2(subtotal + subtotal * (payload.iva / 100));
    return { valor, total };
  }

  private round2(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
}
