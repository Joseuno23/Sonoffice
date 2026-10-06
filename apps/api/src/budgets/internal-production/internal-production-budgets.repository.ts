import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ResultSetHeader } from 'mysql2';
import internalProductionBudgetConfig from '../../config/internal-production-budget.config';
import { DbService } from '../../db/db.service';
import { BillingPrintRow, BudgetHeaderRow, BudgetRow, CostOrderDetailRow, CountRow, DetailRow, OptionRow, SupportAttachmentRow, SupportBudgetRow } from './internal-production-budgets.types';

@Injectable()
export class InternalProductionBudgetsRepository {
  constructor(
    private readonly db: DbService,
    @Inject(internalProductionBudgetConfig.KEY)
    private readonly config: ConfigType<typeof internalProductionBudgetConfig>,
  ) {}

  private get type() { return this.config.type; }
  private get active() { return this.config.statuses.active; }
  private get printed() { return this.config.statuses.printed; }
  private get creditNote() { return this.config.statuses.creditNote; }
  private get cancelled() { return this.config.statuses.cancelled; }

  private totalsSql() {
    return `psin_valor = (SELECT COALESCE(SUM(dpsin_total), 0) FROM det_prodi WHERE psin_id = ?),
      psin_total = ((psin_valor - (psin_valor * (psin_desc / 100))) + ((psin_valor - (psin_valor * (psin_desc / 100))) * (psin_iva / 100)))`;
  }

  private async recalc(connection: PoolConnection, id: number) {
    await connection.execute<ResultSetHeader>(`UPDATE presup_prodi SET ${this.totalsSql()} WHERE psin_id = ?`, [id, id]);
  }

  private async recalcCostOrder(connection: PoolConnection, orderId: number, userId: number) {
    await connection.execute<ResultSetHeader>(`UPDATE sys_orden_costos SET cobrado = (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), faltante = GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0), tipo_ppto = CASE WHEN EXISTS (SELECT 1 FROM sys_oc_ppto WHERE id_orden = ?) THEN tipo_ppto ELSE NULL END, id_estado = CASE WHEN id_estado <> ? AND GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0) = 0 THEN ? WHEN id_estado = ? AND GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0) > 0 THEN ? ELSE id_estado END, id_usuario_mod = ?, fecha_mod = NOW() WHERE id_orden = ?`, [orderId, orderId, orderId, this.config.costOrderStatuses.finalized, orderId, this.config.costOrderStatuses.finalized, this.config.costOrderStatuses.finalized, orderId, this.config.costOrderStatuses.printed, userId, orderId]);
  }

  private normalizeLabel(value: string | null): string {
    return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private excludedStatusLabels(): Set<string> {
    return new Set(this.config.excludedStatusLabels.map((label) => this.normalizeLabel(label)));
  }

  async list(filters: { search: string | null; estado: number | null }, limit: number, offset: number): Promise<{ rows: BudgetRow[]; total: number }> {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filters.search) {
      const like = `%${filters.search}%`;
      where.push('(p.psin_id LIKE ? OR c.nombre LIKE ? OR ca.camp_nombre LIKE ? OR pd.pdcl_nombre LIKE ? OR s.nombre LIKE ? OR p.psin_numorden LIKE ? OR p.psin_numcotizacion LIKE ? OR CONCAT(COALESCE(u.usr_nombre, \'\'), \' \', COALESCE(u.usr_apellido, \'\')) LIKE ?)');
      params.push(like, like, like, like, like, like, like, like);
    }
    if (filters.estado) { where.push('p.psin_estado = ?'); params.push(filters.estado); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = `FROM presup_prodi p
      LEFT JOIN cat_estados e ON p.psin_estado = e.est_id
      LEFT JOIN sys_clients c ON p.pvcl_id_clie = c.id_client
      LEFT JOIN cat_campanas ca ON p.camp_id = ca.camp_id
      LEFT JOIN cat_prodsclies pd ON p.pdcl_id = pd.pdcl_id
      LEFT JOIN sys_tipo_servicio s ON p.cod_ser = s.id_tipo_servicio
      LEFT JOIN usuarios u ON p.usr_id_crea = u.usr_id`;
    const rows = await this.db.execute<BudgetRow[]>(`SELECT p.psin_id AS id, p.psin_fechpresup AS fecha, p.psin_estado AS idEstado, e.est_nombre AS estado, e.est_color AS estadoColor, c.nombre AS cliente, 'SONOVISTA' AS proveedor, ca.camp_nombre AS campana, pd.pdcl_nombre AS producto, s.nombre AS servicio, p.psin_numorden AS ordenCliente, p.psin_numorden AS orderNumber, p.psin_numcotizacion AS cotizacion, p.psin_valor AS valor, p.psin_total AS total, 0 AS incentivoXServicio, p.num_impresiones AS numImpresiones, CONCAT(u.usr_nombre, ' ', u.usr_apellido) AS usuario ${from} ${clause} ORDER BY p.psin_id DESC LIMIT ${limit} OFFSET ${offset}`, params);
    const count = await this.db.execute<CountRow[]>(`SELECT COUNT(*) AS total ${from} ${clause}`, params);
    return { rows, total: Number(count[0]?.total ?? 0) };
  }

  async statuses(): Promise<OptionRow[]> {
    const rows = await this.db.execute<OptionRow[]>(`SELECT DISTINCT e.est_id AS id, e.est_nombre AS label FROM presup_prodi p INNER JOIN cat_estados e ON p.psin_estado = e.est_id ORDER BY e.est_nombre`);
    const excluded = this.excludedStatusLabels();
    return rows.filter((row) => !excluded.has(this.normalizeLabel(row.label)));
  }

  async options(table: 'clients' | 'providers' | 'services' | 'campaigns' | 'products' | 'departments' | 'cities' | 'contracts', searchOrClient?: string | number): Promise<OptionRow[]> {
    if (table === 'providers') return [{ id: 0, label: 'SONOVISTA' } as OptionRow];
    if (table === 'clients') {
      const search = typeof searchOrClient === 'string' && searchOrClient.trim() ? `%${searchOrClient.trim()}%` : null;
      return this.db.execute<OptionRow[]>(`SELECT id_client AS id, nombre AS label FROM sys_clients WHERE cliente = 1 AND id_status = ? ${search ? 'AND nombre LIKE ?' : ''} ORDER BY nombre LIMIT 40`, search ? [this.active, search] : [this.active]);
    }
    if (table === 'services') return this.db.execute<OptionRow[]>(`SELECT id_tipo_servicio AS id, nombre AS label FROM sys_tipo_servicio WHERE tipo = ? AND (id_estado = ? OR id_estado IS NULL) ORDER BY nombre`, [this.config.internalServiceType, this.active]);
    if (table === 'campaigns') return this.db.execute<OptionRow[]>(`SELECT camp_id AS id, camp_nombre AS label FROM cat_campanas WHERE pvcl_id = ? AND est_id = ? ORDER BY camp_nombre`, [Number(searchOrClient), this.active]);
    if (table === 'products') return this.db.execute<OptionRow[]>(`SELECT pdcl_id AS id, pdcl_nombre AS label FROM cat_prodsclies WHERE pvcl_id = ? AND est_id = ? ORDER BY pdcl_nombre`, [Number(searchOrClient), this.active]);
    if (table === 'contracts') {
      return this.db.execute<OptionRow[]>(`SELECT c.id, COALESCE(NULLIF(CONCAT_WS(' | ', NULLIF(c.numero, ''), CASE WHEN c.valor IS NOT NULL THEN CONCAT('Valor ', c.valor) END, CASE WHEN c.fecha_inicio IS NOT NULL OR c.fecha_vencimiento IS NOT NULL THEN CONCAT('Vigencia ', COALESCE(DATE_FORMAT(c.fecha_inicio, '%Y-%m-%d'), ''), CASE WHEN c.fecha_inicio IS NOT NULL AND c.fecha_vencimiento IS NOT NULL THEN ' a ' ELSE '' END, COALESCE(DATE_FORMAT(c.fecha_vencimiento, '%Y-%m-%d'), '')) END), ''), CONCAT('Contrato ', c.id)) AS label FROM sys_contratos c WHERE c.contra_parte = ? AND c.parte = 'CLIENTE' AND c.old = 0 AND c.id_estado = ? ORDER BY c.numero, c.id`, [Number(searchOrClient), this.active]);
    }
    if (table === 'departments') return this.db.execute<OptionRow[]>(`SELECT codigo AS id, nombre AS label FROM sys_departamento ORDER BY nombre`);
    return this.db.execute<OptionRow[]>(`SELECT id_ciudad AS id, nombre AS label FROM sys_ciudades WHERE departamento = ? AND id_estado = ? ORDER BY nombre`, [String(searchOrClient || ''), this.active]);
  }

  async get(id: number): Promise<{ header: BudgetHeaderRow | null; details: DetailRow[]; orders: [] }> {
    const headers = await this.db.execute<BudgetHeaderRow[]>(this.headerSql('p.psin_id = ?'), [id]);
    const details = await this.db.execute<DetailRow[]>(this.detailsSql(), [id]);
    return { header: headers[0] ?? null, details, orders: [] };
  }

  private headerSql(where: string) {
    return `SELECT p.psin_id AS id, p.psin_fechpresup AS fecha, p.psin_estado AS idEstado, e.est_nombre AS estado, e.est_color AS estadoColor, p.pvcl_id_clie AS idCliente, c.nombre AS cliente, c.documento AS clienteDocumento, c.direccion AS clienteDireccion, c.telefono AS clienteTelefono, c.ciudad AS clienteCiudad, 0 AS idProveedor, 'SONOVISTA' AS proveedor, NULL AS proveedorDocumento, NULL AS proveedorDireccion, NULL AS proveedorTelefono, NULL AS proveedorCiudad, p.camp_id AS idCampana, ca.camp_nombre AS campana, p.pdcl_id AS idProducto, pd.pdcl_nombre AS producto, p.cod_ser AS idServicio, s.nombre AS servicio, p.cod_dpto AS idDepartamento, d.nombre AS departamento, p.id_ciudad AS idCiudad, ci.nombre AS ciudad, p.contrato, p.psin_numorden AS ordenCliente, NULL AS formaPago, p.psin_numcotizacion AS cotizacion, p.psin_observa AS observacion, p.psin_desc AS descuento, p.psin_iva AS iva, 0 AS spa, 0 AS ivaSpa, p.psin_valor AS valor, p.psin_total AS total, 0 AS incentivoXServicio, p.num_impresiones AS numImpresiones, p.fecha_anulacion AS fechaAnulacion, p.consecutivo_anulacion AS consecutivoAnulacion, NULL AS ordenId, NULL AS ordenObservacion, NULL AS ordenNumImpresiones, CONCAT(u.usr_nombre, ' ', u.usr_apellido) AS usuario FROM presup_prodi p LEFT JOIN cat_estados e ON p.psin_estado = e.est_id LEFT JOIN sys_clients c ON p.pvcl_id_clie = c.id_client LEFT JOIN cat_campanas ca ON p.camp_id = ca.camp_id LEFT JOIN cat_prodsclies pd ON p.pdcl_id = pd.pdcl_id LEFT JOIN sys_tipo_servicio s ON p.cod_ser = s.id_tipo_servicio LEFT JOIN sys_departamento d ON p.cod_dpto = d.codigo LEFT JOIN sys_ciudades ci ON p.id_ciudad = ci.id_ciudad LEFT JOIN usuarios u ON p.usr_id_crea = u.usr_id WHERE ${where} LIMIT 1`;
  }

  private detailsSql() {
    return `SELECT d.dpsin_id AS id, d.dpsin_cant AS cantidad, d.unidad, d.tpsv_id AS idServicio, s.nombre AS servicio, d.dpsin_detalle AS detalle, d.dpsin_valor AS valor, NULL AS iva, 0 AS incentivo, NULL AS incentivoArea, NULL AS incentivoMedio, d.valor_asignado_oc AS valorAsignadoOc, d.ordcos_id AS ordenCosto, NULL AS snapshotCosto, NULL AS snapshotUtilidadSono, NULL AS snapshotUtilidadProveedor, d.dpsin_observ AS snapshotDetalle, NULL AS snapshotNota FROM det_prodi d LEFT JOIN sys_tipo_servicio s ON d.tpsv_id = s.id_tipo_servicio WHERE d.psin_id = ? ORDER BY d.dpsin_id`;
  }

  async printData(id: number): Promise<{ header: BudgetHeaderRow | null; details: DetailRow[]; billing: BillingPrintRow | null; bill: { consecutivo: string | number | null } | null; history: [] }> {
    const header = (await this.db.execute<BudgetHeaderRow[]>(this.headerSql('p.psin_id = ?'), [id]))[0] ?? null;
    const details = await this.db.execute<DetailRow[]>(this.detailsSql(), [id]);
    const billing = (await this.db.execute<BillingPrintRow[]>(`SELECT nit, razon_social_emisor AS razonSocial, nombre_comercial_emisor AS nombreComercial, direccion_emisor AS direccion, ciudad_emisor AS ciudad, departamento_emisor AS departamento, pais_emisor AS pais, telefono_emisor AS telefono, digito_verificacion_emisor AS dv FROM sys_data_billing LIMIT 1`))[0] ?? null;
    const bill = (await this.db.execute<(RowDataPacket & { consecutivo: string | number | null })[]>(`SELECT f.consecutivo FROM factura_presup fp INNER JOIN facturacion f ON f.factura_id = fp.factura_id WHERE fp.id_doc = ? AND fp.modulo_id = ? LIMIT 1`, [id, this.type]))[0] ?? null;
    return { header, details, billing, bill, history: [] };
  }

  async headerTaxValues(id: number): Promise<{ iva: number; spa: number; ivaSpa: number } | null> {
    const rows = await this.db.execute<(RowDataPacket & { iva: number | null })[]>(`SELECT psin_iva AS iva FROM presup_prodi WHERE psin_id = ? LIMIT 1`, [id]);
    const row = rows[0];
    return row ? { iva: Number(row.iva ?? 0), spa: 0, ivaSpa: 0 } : null;
  }

  async supportAttachments(id: number): Promise<SupportAttachmentRow[]> {
    return this.db.execute<SupportAttachmentRow[]>(`SELECT ppto, modulo, nombre, fecha FROM sys_adjunto_ppto WHERE ppto = ? AND modulo = ? ORDER BY fecha DESC, nombre`, [id, this.type]);
  }

  async supportBudget(id: number): Promise<SupportBudgetRow | null> {
    const rows = await this.db.execute<SupportBudgetRow[]>(`SELECT p.psin_id AS id, p.psin_estado AS idEstado, e.est_nombre AS estado FROM presup_prodi p LEFT JOIN cat_estados e ON p.psin_estado = e.est_id WHERE p.psin_id = ? LIMIT 1`, [id]);
    return rows[0] ?? null;
  }

  async supportAttachment(id: number, filename: string): Promise<SupportAttachmentRow | null> {
    const rows = await this.db.execute<SupportAttachmentRow[]>(`SELECT ppto, modulo, nombre, fecha FROM sys_adjunto_ppto WHERE ppto = ? AND modulo = ? AND nombre = ? ORDER BY fecha DESC LIMIT 1`, [id, this.type, filename]);
    return rows[0] ?? null;
  }

  async addSupportAttachment(id: number, filename: string): Promise<void> {
    await this.db.execute<ResultSetHeader>(`INSERT INTO sys_adjunto_ppto (nombre, ppto, modulo, fecha) VALUES (?, ?, ?, CURDATE())`, [filename, id, this.type]);
  }

  async updateOrderNumber(id: number, order: string | null): Promise<'ok' | 'not-found' | 'invalid-state'> {
    return this.db.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number })[]>(`SELECT psin_estado AS state FROM presup_prodi WHERE psin_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      if (![this.active, this.printed].includes(Number(rows[0].state))) return 'invalid-state';
      await connection.execute<ResultSetHeader>(`UPDATE presup_prodi SET psin_numorden = ? WHERE psin_id = ?`, [order, id]);
      return 'ok';
    });
  }

  async create(userId: number, payload: any): Promise<number | 'sequence-not-found'> {
    return this.db.transaction(async (connection) => {
      const [seq] = await connection.execute<(RowDataPacket & { consecutivo: number })[]>(`SELECT consecutivo FROM sys_consecutivos WHERE tipo = 'presupuesto' FOR UPDATE`);
      if (seq.length !== 1) return 'sequence-not-found';
      const id = Number(seq[0].consecutivo ?? 0) + 1;
      await connection.execute<ResultSetHeader>(`INSERT INTO presup_prodi (psin_id, psin_fechpresup, presup_fechacrea, psin_estado, usr_id_crea, usr_id_mod, pvcl_id_clie, pvcl_id_prov, camp_id, pdcl_id, cod_ser, contrato, cod_dpto, id_ciudad, psin_numorden, psin_numcotizacion, psin_observa, psin_desc, psin_iva, psin_valor, psin_total, num_impresiones) VALUES (?, CURDATE(), NOW(), ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, -1)`, [id, this.active, userId, userId, payload.idCliente, payload.idCampana, payload.idProducto, payload.idServicio, payload.contrato, payload.idDepartamento ?? null, payload.idCiudad ?? null, payload.ordenCliente, payload.cotizacion, payload.observacion, payload.descuento, payload.iva]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_consecutivos SET consecutivo = ? WHERE tipo = 'presupuesto'`, [id]);
      return id;
    });
  }

  async update(id: number, userId: number, payload: any): Promise<'ok' | 'not-found' | 'not-active'> {
    return this.db.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { id: number; state: number })[]>(`SELECT psin_id AS id, psin_estado AS state FROM presup_prodi WHERE psin_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      if (Number(rows[0].state) !== this.active) return 'not-active';
      await connection.execute<ResultSetHeader>(`UPDATE presup_prodi SET usr_id_mod = ?, pvcl_id_clie = ?, pvcl_id_prov = 0, camp_id = ?, pdcl_id = ?, cod_ser = ?, contrato = ?, cod_dpto = ?, id_ciudad = ?, psin_numorden = ?, psin_numcotizacion = ?, psin_observa = ?, psin_desc = ?, psin_iva = ? WHERE psin_id = ?`, [userId, payload.idCliente, payload.idCampana, payload.idProducto, payload.idServicio, payload.contrato, payload.idDepartamento ?? null, payload.idCiudad ?? null, payload.ordenCliente, payload.cotizacion, payload.observacion, payload.descuento, payload.iva, id]);
      await this.recalc(connection, id);
      return 'ok';
    });
  }

  async saveDetail(budgetId: number, detailId: number | null, payload: any): Promise<'ok' | 'not-found' | 'not-active'> {
    return this.db.transaction(async (connection) => {
      const [headers] = await connection.execute<(RowDataPacket & { state: number })[]>(`SELECT psin_estado AS state FROM presup_prodi WHERE psin_id = ? FOR UPDATE`, [budgetId]);
      if (!headers[0]) return 'not-found';
      if (Number(headers[0].state) !== this.active) return 'not-active';
      const quantity = Number(payload.cantidad ?? 1) || 1;
      const total = Number(payload.valor ?? 0) * quantity;
      if (detailId) {
        const [details] = await connection.execute<DetailRow[]>(`SELECT dpsin_id AS id FROM det_prodi WHERE psin_id = ? AND dpsin_id = ? FOR UPDATE`, [budgetId, detailId]);
        if (!details[0]) return 'not-found';
        await connection.execute<ResultSetHeader>(`UPDATE det_prodi SET unidad = ?, tpsv_id = ?, dpsin_detalle = ?, dpsin_cant = ?, dpsin_valor = ?, dpsin_total = ?, dpsin_observ = ? WHERE psin_id = ? AND dpsin_id = ?`, [payload.unidad, payload.idServicio, payload.detalle, quantity, payload.valor, total, payload.observacion ?? null, budgetId, detailId]);
      } else {
        await connection.execute<ResultSetHeader>(`INSERT INTO det_prodi (psin_id, unidad, tpsv_id, dpsin_detalle, dpsin_cant, dpsin_valor, dpsin_total, dpsin_observ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [budgetId, payload.unidad, payload.idServicio, payload.detalle, quantity, payload.valor, total, payload.observacion ?? null]);
      }
      await this.recalc(connection, budgetId);
      return 'ok';
    });
  }

  async deleteDetail(budgetId: number, detailId: number, userId: number): Promise<'ok' | 'not-found' | 'not-active' | 'cost-order-link-unavailable'> {
    return this.db.transaction(async (connection) => {
      const [headers] = await connection.execute<(RowDataPacket & { state: number })[]>(`SELECT psin_estado AS state FROM presup_prodi WHERE psin_id = ? FOR UPDATE`, [budgetId]);
      if (!headers[0]) return 'not-found';
      if (Number(headers[0].state) !== this.active) return 'not-active';
      const [links] = await connection.execute<(RowDataPacket & { idOrden: number; idDetalleOrden: number; cobradoItem: number | null })[]>(`SELECT id_orden AS idOrden, id_detalle_orden AS idDetalleOrden, cobrado_item AS cobradoItem FROM sys_oc_ppto WHERE id_ppto = ? AND id_detalle_ppto = ? AND modulo = ? FOR UPDATE`, [budgetId, detailId, this.type]);
      const orderIds = new Set<number>();
      for (const link of links) {
        const orderId = Number(link.idOrden);
        const orderDetailId = Number(link.idDetalleOrden);
        orderIds.add(orderId);
        const [orderDetail] = await connection.execute<(RowDataPacket & { id: number })[]>(`SELECT id_detalle AS id FROM sys_detalle_costo WHERE id_orden = ? AND id_detalle = ? FOR UPDATE`, [orderId, orderDetailId]);
        if (orderDetail.length !== 1) return 'cost-order-link-unavailable';
        await connection.execute<ResultSetHeader>(`UPDATE sys_detalle_costo SET total_cobrado = GREATEST(COALESCE(total_cobrado, 0) - ?, 0) WHERE id_orden = ? AND id_detalle = ?`, [Number(link.cobradoItem ?? 0), orderId, orderDetailId]);
      }
      await connection.execute<ResultSetHeader>(`DELETE FROM sys_oc_ppto WHERE id_ppto = ? AND id_detalle_ppto = ? AND modulo = ?`, [budgetId, detailId, this.type]);
      const [result] = await connection.execute<ResultSetHeader>(`DELETE FROM det_prodi WHERE psin_id = ? AND dpsin_id = ?`, [budgetId, detailId]);
      if (result.affectedRows !== 1) return 'not-found';
      await this.recalc(connection, budgetId);
      for (const orderId of orderIds) await this.recalcCostOrder(connection, orderId, userId);
      return 'ok';
    });
  }

  async costOrderDetails(budgetId: number, orderId: number): Promise<CostOrderDetailRow[] | 'not-found' | 'not-active' | 'order-unavailable' | 'client-mismatch' | 'type-mismatch'> {
    return this.db.transaction(async (connection) => {
      const [budgets] = await connection.execute<(RowDataPacket & { id: number; state: number; idCliente: number })[]>(`SELECT psin_id AS id, psin_estado AS state, pvcl_id_clie AS idCliente FROM presup_prodi WHERE psin_id = ?`, [budgetId]);
      const budget = budgets[0];
      if (!budget) return 'not-found';
      if (Number(budget.state) !== this.active) return 'not-active';
      const [orders] = await connection.execute<(RowDataPacket & { id: number; state: number; idCliente: number; tipo: string | null; tipoPpto: number | null })[]>(`SELECT id_orden AS id, id_estado AS state, id_cliente AS idCliente, tipo, tipo_ppto AS tipoPpto FROM sys_orden_costos WHERE id_orden = ?`, [orderId]);
      const order = orders[0];
      if (!order || [this.config.costOrderStatuses.canceled, this.config.costOrderStatuses.finalized, this.config.costOrderStatuses.pending].includes(Number(order.state))) return 'order-unavailable';
      if (Number(order.idCliente) !== Number(budget.idCliente)) return 'client-mismatch';
      if (String(order.tipo || '').toUpperCase() !== 'I' || (order.tipoPpto !== null && Number(order.tipoPpto) !== this.type)) return 'type-mismatch';
      return connection.execute<CostOrderDetailRow[]>(`SELECT d.id_orden AS idOrden, d.id_detalle AS idDetalle, d.detalle, d.total, d.total_cobrado AS totalCobrado, GREATEST(COALESCE(d.total, 0) - COALESCE(d.total_cobrado, 0), 0) AS disponible FROM sys_detalle_costo d WHERE d.id_orden = ? AND GREATEST(COALESCE(d.total, 0) - COALESCE(d.total_cobrado, 0), 0) > 0 ORDER BY d.id_detalle`, [orderId]).then(([rows]) => rows);
    });
  }

  async addCostOrderDetail(budgetId: number, orderId: number, orderDetailId: number, assigned: number, userId: number, detailInput: { idServicio?: number | null; unidad?: string | null }): Promise<DetailRow | 'not-found' | 'not-active' | 'order-unavailable' | 'client-mismatch' | 'detail-unavailable' | 'type-mismatch' | 'unavailable'> {
    return this.db.transaction(async (connection) => {
      const [budgets] = await connection.execute<(RowDataPacket & { id: number; state: number; idCliente: number; idServicio: number | null })[]>(`SELECT psin_id AS id, psin_estado AS state, pvcl_id_clie AS idCliente, cod_ser AS idServicio FROM presup_prodi WHERE psin_id = ? FOR UPDATE`, [budgetId]);
      const budget = budgets[0];
      if (!budget) return 'not-found';
      if (Number(budget.state) !== this.active) return 'not-active';
      const [orders] = await connection.execute<(RowDataPacket & { id: number; state: number; idCliente: number; tipo: string | null; tipoPpto: number | null })[]>(`SELECT id_orden AS id, id_estado AS state, id_cliente AS idCliente, tipo, tipo_ppto AS tipoPpto FROM sys_orden_costos WHERE id_orden = ? FOR UPDATE`, [orderId]);
      const order = orders[0];
      if (!order || [this.config.costOrderStatuses.canceled, this.config.costOrderStatuses.finalized, this.config.costOrderStatuses.pending].includes(Number(order.state))) return 'order-unavailable';
      if (Number(order.idCliente) !== Number(budget.idCliente)) return 'client-mismatch';
      if (String(order.tipo || '').toUpperCase() !== 'I' || (order.tipoPpto !== null && Number(order.tipoPpto) !== this.type)) return 'type-mismatch';
      const [details] = await connection.execute<(RowDataPacket & { idDetalle: number; detalle: string | null; total: number | null; disponible: number | null })[]>(`SELECT id_detalle AS idDetalle, detalle, total, GREATEST(COALESCE(total, 0) - COALESCE(total_cobrado, 0), 0) AS disponible FROM sys_detalle_costo WHERE id_orden = ? AND id_detalle = ? FOR UPDATE`, [orderId, orderDetailId]);
      const detail = details[0];
      if (!detail) return 'detail-unavailable';
      if (assigned <= 0 || Number(detail.disponible ?? 0) + 0.0001 < assigned) return 'unavailable';
      const idServicio = detailInput.idServicio ?? budget.idServicio;
      if (!idServicio) return 'not-found';
      const unidad = detailInput.unidad || '1';
      const increasePercent = await this.internalIncreasePercent(connection);
      const increased = this.round2(assigned * (1 + increasePercent / 100));
      const [orderDetailUpdate] = await connection.execute<ResultSetHeader>(`UPDATE sys_detalle_costo SET total_cobrado = COALESCE(total_cobrado, 0) + ? WHERE id_orden = ? AND id_detalle = ? AND GREATEST(COALESCE(total, 0) - COALESCE(total_cobrado, 0), 0) >= ?`, [assigned, orderId, orderDetailId, assigned]);
      if (orderDetailUpdate.affectedRows !== 1) return 'unavailable';
      const [insert] = await connection.execute<ResultSetHeader>(`INSERT INTO det_prodi (psin_id, unidad, tpsv_id, dpsin_detalle, dpsin_cant, dpsin_valor, dpsin_total, dpsin_ordaumento, dpsin_observ, valor_asignado_oc, ordcos_id) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`, [budgetId, unidad, idServicio, detail.detalle || '', increased, increased, increasePercent, `OC ${orderId}`, assigned, orderId]);
      await connection.execute<ResultSetHeader>(`INSERT INTO sys_oc_ppto (id_orden, id_ppto, id_detalle_ppto, id_detalle_orden, modulo, cobrado_item) VALUES (?, ?, ?, ?, ?, ?)`, [orderId, budgetId, insert.insertId, orderDetailId, this.type, assigned]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_orden_costos SET tipo_ppto = CASE WHEN tipo_ppto IS NULL THEN ? ELSE tipo_ppto END WHERE id_orden = ?`, [this.type, orderId]);
      await this.recalc(connection, budgetId);
      await this.recalcCostOrder(connection, orderId, userId);
      const [created] = await connection.execute<DetailRow[]>(`SELECT d.dpsin_id AS id, d.dpsin_cant AS cantidad, d.unidad, d.tpsv_id AS idServicio, s.nombre AS servicio, d.dpsin_detalle AS detalle, d.dpsin_valor AS valor, NULL AS iva, 0 AS incentivo, NULL AS incentivoArea, NULL AS incentivoMedio, d.valor_asignado_oc AS valorAsignadoOc, d.ordcos_id AS ordenCosto, NULL AS snapshotCosto, NULL AS snapshotUtilidadSono, NULL AS snapshotUtilidadProveedor, d.dpsin_observ AS snapshotDetalle, NULL AS snapshotNota FROM det_prodi d LEFT JOIN sys_tipo_servicio s ON d.tpsv_id = s.id_tipo_servicio WHERE d.psin_id = ? AND d.dpsin_id = ? LIMIT 1`, [budgetId, insert.insertId]);
      return created[0] ?? 'detail-unavailable';
    });
  }

  async markPrinted(id: number): Promise<'ok' | 'already-printed' | 'not-found' | 'skipped-state'> {
    return this.db.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number; prints: number | null })[]>(`SELECT psin_estado AS state, num_impresiones AS prints FROM presup_prodi WHERE psin_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      if (Number(rows[0].state) === this.printed) return 'already-printed';
      if (Number(rows[0].state) !== this.active) return 'skipped-state';
      await connection.execute<ResultSetHeader>(`UPDATE presup_prodi SET psin_estado = ?, num_impresiones = COALESCE(num_impresiones, -1) + 1 WHERE psin_id = ?`, [this.printed, id]);
      return 'ok';
    });
  }

  async anule(id: number, userId: number, observation: string | null): Promise<'ok' | 'not-found' | 'invalid-state' | 'has-bill' | 'sequence-not-found' | 'requires-observation' | 'cost-order-link-unavailable'> {
    return this.db.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number; prints: number | null })[]>(`SELECT psin_estado AS state, num_impresiones AS prints FROM presup_prodi WHERE psin_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      const state = Number(rows[0].state);
      const prints = Number(rows[0].prints ?? -1);
      if (!((state === this.active && prints === -1) || state === this.printed)) return 'invalid-state';
      const [bill] = await connection.execute<CountRow[]>(`SELECT COUNT(*) AS total FROM factura_presup WHERE id_doc = ? AND modulo_id = ?`, [id, this.type]);
      if (Number(bill[0]?.total ?? 0) > 0) return 'has-bill';
      const [seq] = await connection.execute<(RowDataPacket & { consecutivo: number })[]>(`SELECT consecutivo FROM sys_consecutivos WHERE tipo = 'anulacion_ppto' FOR UPDATE`);
      if (seq.length !== 1) return 'sequence-not-found';
      const next = Number(seq[0].consecutivo ?? 0) + 1;
      const [links] = await connection.execute<(RowDataPacket & { idOrden: number; idDetalleOrden: number; cobradoItem: number | null })[]>(`SELECT id_orden AS idOrden, id_detalle_orden AS idDetalleOrden, cobrado_item AS cobradoItem FROM sys_oc_ppto WHERE id_ppto = ? AND modulo = ? FOR UPDATE`, [id, this.type]);
      if (links.length > 0 && !observation) return 'requires-observation';
      const orderCharges = new Map<string, { orderId: number; detailId: number; amount: number }>();
      for (const link of links) {
        const orderId = Number(link.idOrden);
        const detailId = Number(link.idDetalleOrden);
        const key = `${orderId}:${detailId}`;
        const current = orderCharges.get(key);
        orderCharges.set(key, { orderId, detailId, amount: (current?.amount ?? 0) + Number(link.cobradoItem ?? 0) });
      }
      for (const charge of orderCharges.values()) {
        await connection.execute<ResultSetHeader>(`UPDATE sys_detalle_costo SET total_cobrado = GREATEST(COALESCE(total_cobrado, 0) - ?, 0) WHERE id_orden = ? AND id_detalle = ?`, [charge.amount, charge.orderId, charge.detailId]);
      }
      await connection.execute<ResultSetHeader>(`DELETE FROM sys_oc_ppto WHERE id_ppto = ? AND modulo = ?`, [id, this.type]);
      for (const orderId of new Set([...orderCharges.values()].map((row) => row.orderId))) await this.recalcCostOrder(connection, orderId, userId);
      await connection.execute<ResultSetHeader>(`UPDATE presup_prodi SET psin_estado = ?, usr_id_mod = ?, fecha_anulacion = CURDATE(), consecutivo_anulacion = ?, psin_observa = CASE WHEN ? IS NULL THEN psin_observa ELSE ? END WHERE psin_id = ?`, [this.cancelled, userId, next, observation, observation, id]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_consecutivos SET consecutivo = ? WHERE tipo = 'anulacion_ppto'`, [next]);
      return 'ok';
    });
  }

  async duplicate(id: number, userId: number): Promise<number | 'not-found' | 'sequence-not-found'> {
    return this.copyBudget(id, userId, 'Duplicado del Presupuesto');
  }

  async replace(id: number, userId: number): Promise<number | 'not-found' | 'invalid-state' | 'sequence-not-found'> {
    const source = (await this.db.execute<(RowDataPacket & { state: number })[]>(`SELECT psin_estado AS state FROM presup_prodi WHERE psin_id = ?`, [id]))[0];
    if (!source) return 'not-found';
    if (Number(source.state) !== this.creditNote) return 'invalid-state';
    return this.copyBudget(id, userId, 'Reemplazo del Presupuesto');
  }

  private async copyBudget(id: number, userId: number, prefix: string): Promise<number | 'not-found' | 'sequence-not-found'> {
    return this.db.transaction(async (connection) => {
      const [source] = await connection.execute<(RowDataPacket & { id: number })[]>(`SELECT psin_id AS id FROM presup_prodi WHERE psin_id = ? FOR UPDATE`, [id]);
      if (source.length !== 1) return 'not-found';
      const [seq] = await connection.execute<(RowDataPacket & { consecutivo: number })[]>(`SELECT consecutivo FROM sys_consecutivos WHERE tipo = 'presupuesto' FOR UPDATE`);
      if (seq.length !== 1) return 'sequence-not-found';
      const newId = Number(seq[0].consecutivo ?? 0) + 1;
      const [insert] = await connection.execute<ResultSetHeader>(`INSERT INTO presup_prodi (psin_id, psin_fechpresup, presup_fechacrea, psin_estado, usr_id_crea, usr_id_mod, pvcl_id_clie, pvcl_id_prov, camp_id, pdcl_id, cod_ser, contrato, cod_dpto, id_ciudad, psin_numorden, psin_numcotizacion, psin_observa, psin_desc, psin_iva, psin_valor, psin_total, num_impresiones) SELECT ?, CURDATE(), NOW(), ?, ?, ?, pvcl_id_clie, 0, camp_id, pdcl_id, cod_ser, contrato, cod_dpto, id_ciudad, psin_numorden, psin_numcotizacion, CONCAT(COALESCE(psin_observa, ''), ' ', ?, ' ', psin_id), psin_desc, psin_iva, psin_valor, psin_total, -1 FROM presup_prodi WHERE psin_id = ?`, [newId, this.active, userId, userId, prefix, id]);
      if (insert.affectedRows !== 1) return 'not-found';
      await connection.execute<ResultSetHeader>(`INSERT INTO det_prodi (psin_id, dpsin_detalle, dpsin_cant, dpsin_valor, dpsin_total, dpsin_ordaumento, tpsv_id, unidad, dpsin_observ) SELECT ?, dpsin_detalle, dpsin_cant, dpsin_valor, dpsin_total, dpsin_ordaumento, tpsv_id, unidad, dpsin_observ FROM det_prodi WHERE psin_id = ?`, [newId, id]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_consecutivos SET consecutivo = ? WHERE tipo = 'presupuesto'`, [newId]);
      return newId;
    });
  }

  private async internalIncreasePercent(connection: PoolConnection): Promise<number> {
    const [rows] = await connection.execute<(RowDataPacket & { percent: number | null })[]>(`SELECT porcentaje_interna AS percent FROM sys_data_billing LIMIT 1`);
    const percent = Number(rows[0]?.percent ?? 20);
    return Number.isFinite(percent) && percent >= 20 ? percent : 20;
  }

  private round2(n: number): number { return Math.round(n * 100) / 100; }
}
