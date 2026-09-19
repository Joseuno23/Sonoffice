import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ResultSetHeader } from 'mysql2';
import externalProductionBudgetConfig from '../../config/external-production-budget.config';
import { DbService } from '../../db/db.service';
import { BillingPrintRow, BudgetHeaderRow, BudgetRow, CostOrderDetailRow, CountRow, DetailRow, IncentiveRow, LegacyButtonPermissionRow, OptionRow, OrderRow, SupportAttachmentRow, SupportBudgetRow } from './external-production-budgets.types';

@Injectable()
export class ExternalProductionBudgetsRepository {
  constructor(
    private readonly db: DbService,
    @Inject(externalProductionBudgetConfig.KEY)
    private readonly config: ConfigType<typeof externalProductionBudgetConfig>,
  ) {}

  private get type() { return this.config.type; }
  private get tpoDoc() { return this.config.tpoDoc; }
  private get active() { return this.config.statuses.active; }
  private get printed() { return this.config.statuses.printed; }
  private get creditNote() { return this.config.statuses.creditNote; }
  private get cancelled() { return this.config.statuses.cancelled; }

  private totalsSql() {
    return `psex_valor = (SELECT COALESCE(SUM(dprode_valor), 0) FROM det_prode WHERE psex_id = ?),
      psex_total = ((psex_valor - (psex_valor * (psex_desc / 100))) + ((psex_valor - (psex_valor * (psex_desc / 100))) * (psex_iva / 100)) + ((psex_valor - (psex_valor * (psex_desc / 100))) * (psex_spa / 100)) + (((psex_valor - (psex_valor * (psex_desc / 100))) * (psex_spa / 100)) * (psex_ivaspa / 100)))`;
  }

  private async recalc(connection: PoolConnection, id: number) {
    await connection.execute<ResultSetHeader>(`UPDATE presup_prode SET ${this.totalsSql()} WHERE psex_id = ?`, [id, id]);
    await connection.execute<ResultSetHeader>(
      `UPDATE presup_prode SET incentivo_x_servicio = CASE WHEN EXISTS (SELECT 1 FROM det_prode WHERE psex_id = ? AND COALESCE(incentivo, 0) > 0) THEN 1 ELSE 0 END WHERE psex_id = ?`,
      [id, id],
    );
  }

  private async recalcCostOrder(connection: PoolConnection, orderId: number, userId: number) {
    await connection.execute<ResultSetHeader>(`UPDATE sys_orden_costos SET cobrado = (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), faltante = GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0), tipo_ppto = CASE WHEN EXISTS (SELECT 1 FROM sys_oc_ppto WHERE id_orden = ?) THEN tipo_ppto ELSE NULL END, id_estado = CASE WHEN id_estado <> ? AND GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0) = 0 THEN ? WHEN id_estado = ? AND GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0) > 0 THEN ? ELSE id_estado END, id_usuario_mod = ?, fecha_mod = NOW() WHERE id_orden = ?`, [orderId, orderId, orderId, this.config.costOrderStatuses.finalized, orderId, this.config.costOrderStatuses.finalized, this.config.costOrderStatuses.finalized, orderId, this.config.costOrderStatuses.printed, userId, orderId]);
  }

  private async findMatchingIncentive(connection: PoolConnection, incentiveId: number, clientId: number, providerId: number, serviceId: number): Promise<IncentiveRow | null> {
    const [rows] = await connection.execute<IncentiveRow[]>(`SELECT id, costo, utilidad_sono AS utilidadSono, utilidad_proveedor AS utilidadProveedor, area, medio, detalle, nota FROM sys_micro_servicio_incentivos WHERE id = ? AND id_cliente = ? AND id_proveedor = ? AND id_servicio = ? LIMIT 1`, [incentiveId, clientId, providerId, serviceId]);
    return rows[0] ?? null;
  }

  private async saveIncentiveSnapshot(connection: PoolConnection, budgetId: number, detailId: number, budgetDate: Date | string, serviceId: number, value: number, incentive: IncentiveRow, overrideCost?: number) {
    const cost = Number.isFinite(Number(overrideCost)) ? Number(overrideCost) : Number(incentive.costo ?? 0);
    await connection.execute<ResultSetHeader>(`INSERT INTO sys_detalle_micro_servicio_incentivos (ppto, det_ppto, fecha_ppto, tipo_ppto, costo, valor, utilidad_sono, utilidad_proveedor, detalle, nota, medio, area, id_servicio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [budgetId, detailId, budgetDate, this.type, cost, value, incentive.utilidadSono, incentive.utilidadProveedor, incentive.detalle, incentive.nota, incentive.medio, incentive.area, serviceId]);
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
      where.push('(p.psex_id LIKE ? OR c.nombre LIKE ? OR pr.nombre LIKE ? OR ca.camp_nombre LIKE ? OR s.nombre LIKE ? OR p.psex_numorden LIKE ? OR CONCAT(COALESCE(u.usr_nombre, \'\'), \' \', COALESCE(u.usr_apellido, \'\')) LIKE ?)');
      params.push(like, like, like, like, like, like, like);
    }
    if (filters.estado) { where.push('p.psex_estado = ?'); params.push(filters.estado); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = `FROM presup_prode p
      LEFT JOIN cat_estados e ON p.psex_estado = e.est_id
      LEFT JOIN sys_clients c ON p.pvcl_id_clie = c.id_client
      LEFT JOIN sys_clients pr ON p.pvcl_id_prov = pr.id_client
      LEFT JOIN cat_campanas ca ON p.camp_id = ca.camp_id
      LEFT JOIN cat_prodsclies pd ON p.pdcl_id = pd.pdcl_id
      LEFT JOIN sys_tipo_servicio s ON p.tpsv_id = s.id_tipo_servicio
      LEFT JOIN usuarios u ON p.usr_id_crea = u.usr_id`;
    const rows = await this.db.execute<BudgetRow[]>(`SELECT p.psex_id AS id, p.psex_fecha AS fecha, p.psex_estado AS idEstado, e.est_nombre AS estado, e.est_color AS estadoColor, c.nombre AS cliente, pr.nombre AS proveedor, ca.camp_nombre AS campana, pd.pdcl_nombre AS producto, s.nombre AS servicio, p.psex_numorden AS ordenCliente, p.psex_numorden AS orderNumber, p.psex_numcotizacion AS cotizacion, p.psex_valor AS valor, p.psex_total AS total, p.incentivo_x_servicio AS incentivoXServicio, p.num_impresiones AS numImpresiones, CONCAT(u.usr_nombre, ' ', u.usr_apellido) AS usuario ${from} ${clause} ORDER BY p.psex_id DESC LIMIT ${limit} OFFSET ${offset}`, params);
    const count = await this.db.execute<CountRow[]>(`SELECT COUNT(*) AS total ${from} ${clause}`, params);
    return { rows, total: Number(count[0]?.total ?? 0) };
  }

  async statuses(): Promise<OptionRow[]> {
    const rows = await this.db.execute<OptionRow[]>(`SELECT DISTINCT e.est_id AS id, e.est_nombre AS label FROM presup_prode p INNER JOIN cat_estados e ON p.psex_estado = e.est_id ORDER BY e.est_nombre`);
    const excluded = this.excludedStatusLabels();
    return rows.filter((row) => !excluded.has(this.normalizeLabel(row.label)));
  }

  async options(table: 'clients' | 'providers' | 'services' | 'campaigns' | 'products', searchOrClient?: string | number): Promise<OptionRow[]> {
    if (table === 'clients' || table === 'providers') {
      const flag = table === 'clients' ? 'cliente' : 'proveedor';
      const search = typeof searchOrClient === 'string' && searchOrClient.trim() ? `%${searchOrClient.trim()}%` : null;
      return this.db.execute<OptionRow[]>(`SELECT id_client AS id, nombre AS label FROM sys_clients WHERE ${flag} = 1 AND id_status = ? ${search ? 'AND nombre LIKE ?' : ''} ORDER BY nombre LIMIT 40`, search ? [this.active, search] : [this.active]);
    }
    if (table === 'services') return this.db.execute<OptionRow[]>(`SELECT id_tipo_servicio AS id, nombre AS label FROM sys_tipo_servicio WHERE tipo = ? AND (id_estado = ? OR id_estado IS NULL) ORDER BY nombre`, [this.config.externalServiceType, this.active]);
    if (table === 'campaigns') return this.db.execute<OptionRow[]>(`SELECT camp_id AS id, camp_nombre AS label FROM cat_campanas WHERE pvcl_id = ? AND est_id = ? ORDER BY camp_nombre`, [Number(searchOrClient), this.active]);
    return this.db.execute<OptionRow[]>(`SELECT pdcl_id AS id, pdcl_nombre AS label FROM cat_prodsclies WHERE pvcl_id = ? AND est_id = ? ORDER BY pdcl_nombre`, [Number(searchOrClient), this.active]);
  }

  async get(id: number): Promise<{ header: BudgetHeaderRow | null; details: DetailRow[]; orders: OrderRow[] }> {
    const headers = await this.db.execute<BudgetHeaderRow[]>(this.headerSql('p.psex_id = ?'), [this.tpoDoc, id]);
    const details = await this.db.execute<DetailRow[]>(`SELECT d.dprode_id AS id, d.unidad, d.tpsv_id AS idServicio, s.nombre AS servicio, d.dprode_detalle AS detalle, d.dprode_valor AS valor, d.dprode_iva AS iva, d.incentivo, mi.area AS incentivoArea, mi.medio AS incentivoMedio, d.valor_asignado_oc AS valorAsignadoOc, d.ordcos_id AS ordenCosto, si.costo AS snapshotCosto, si.utilidad_sono AS snapshotUtilidadSono, si.utilidad_proveedor AS snapshotUtilidadProveedor, si.detalle AS snapshotDetalle, si.nota AS snapshotNota FROM det_prode d LEFT JOIN sys_tipo_servicio s ON d.tpsv_id = s.id_tipo_servicio LEFT JOIN sys_micro_servicio_incentivos mi ON d.incentivo = mi.id LEFT JOIN sys_detalle_micro_servicio_incentivos si ON si.ppto = d.psex_id AND si.det_ppto = d.dprode_id AND si.tipo_ppto = ? WHERE d.psex_id = ? ORDER BY d.dprode_id`, [this.type, id]);
    const orders = await this.orders(id);
    return { header: headers[0] ?? null, details, orders };
  }

  private headerSql(where: string) {
    return `SELECT p.psex_id AS id, p.psex_fecha AS fecha, p.psex_estado AS idEstado, e.est_nombre AS estado, e.est_color AS estadoColor, p.pvcl_id_clie AS idCliente, c.nombre AS cliente, c.documento AS clienteDocumento, c.direccion AS clienteDireccion, c.telefono AS clienteTelefono, c.ciudad AS clienteCiudad, p.pvcl_id_prov AS idProveedor, pr.nombre AS proveedor, pr.documento AS proveedorDocumento, pr.direccion AS proveedorDireccion, pr.telefono AS proveedorTelefono, pr.ciudad AS proveedorCiudad, p.camp_id AS idCampana, ca.camp_nombre AS campana, p.pdcl_id AS idProducto, pd.pdcl_nombre AS producto, p.tpsv_id AS idServicio, s.nombre AS servicio, p.contrato, p.psex_numorden AS ordenCliente, p.psex_formapago AS formaPago, p.psex_numcotizacion AS cotizacion, p.psex_observacion AS observacion, p.psex_desc AS descuento, p.psex_iva AS iva, p.psex_spa AS spa, p.psex_ivaspa AS ivaSpa, p.psex_valor AS valor, p.psex_total AS total, p.incentivo_x_servicio AS incentivoXServicio, p.num_impresiones AS numImpresiones, p.fecha_anulacion AS fechaAnulacion, p.consecutivo_anulacion AS consecutivoAnulacion, o.ord_id AS ordenId, o.ord_observacion AS ordenObservacion, CONCAT(u.usr_nombre, ' ', u.usr_apellido) AS usuario FROM presup_prode p LEFT JOIN cat_estados e ON p.psex_estado = e.est_id LEFT JOIN sys_clients c ON p.pvcl_id_clie = c.id_client LEFT JOIN sys_clients pr ON p.pvcl_id_prov = pr.id_client LEFT JOIN cat_campanas ca ON p.camp_id = ca.camp_id LEFT JOIN cat_prodsclies pd ON p.pdcl_id = pd.pdcl_id LEFT JOIN sys_tipo_servicio s ON p.tpsv_id = s.id_tipo_servicio LEFT JOIN ordenes o ON o.doc_id = p.psex_id AND o.tpo_doc = ? LEFT JOIN usuarios u ON p.usr_id_crea = u.usr_id WHERE ${where} LIMIT 1`;
  }

  async printData(id: number): Promise<{ header: BudgetHeaderRow | null; details: DetailRow[]; billing: BillingPrintRow | null; bill: { consecutivo: string | number | null } | null }> {
    const header = (await this.db.execute<BudgetHeaderRow[]>(this.headerSql('p.psex_id = ?'), [this.tpoDoc, id]))[0] ?? null;
    const details = await this.db.execute<DetailRow[]>(`SELECT d.dprode_id AS id, d.unidad, d.tpsv_id AS idServicio, s.nombre AS servicio, d.dprode_detalle AS detalle, d.dprode_valor AS valor, d.dprode_iva AS iva, d.incentivo, mi.area AS incentivoArea, mi.medio AS incentivoMedio, d.valor_asignado_oc AS valorAsignadoOc, d.ordcos_id AS ordenCosto, si.costo AS snapshotCosto, si.utilidad_sono AS snapshotUtilidadSono, si.utilidad_proveedor AS snapshotUtilidadProveedor, si.detalle AS snapshotDetalle, si.nota AS snapshotNota FROM det_prode d LEFT JOIN sys_tipo_servicio s ON d.tpsv_id = s.id_tipo_servicio LEFT JOIN sys_micro_servicio_incentivos mi ON d.incentivo = mi.id LEFT JOIN sys_detalle_micro_servicio_incentivos si ON si.ppto = d.psex_id AND si.det_ppto = d.dprode_id AND si.tipo_ppto = ? WHERE d.psex_id = ? ORDER BY d.dprode_id`, [this.type, id]);
    const billing = (await this.db.execute<BillingPrintRow[]>(`SELECT nit, razon_social_emisor AS razonSocial, nombre_comercial_emisor AS nombreComercial, direccion_emisor AS direccion, ciudad_emisor AS ciudad, departamento_emisor AS departamento, pais_emisor AS pais, telefono_emisor AS telefono, digito_verificacion_emisor AS dv FROM sys_data_billing LIMIT 1`))[0] ?? null;
    const bill = (await this.db.execute<(RowDataPacket & { consecutivo: string | number | null })[]>(`SELECT f.consecutivo FROM factura_presup fp INNER JOIN facturacion f ON f.factura_id = fp.factura_id WHERE fp.id_doc = ? AND fp.modulo_id = ? LIMIT 1`, [id, this.type]))[0] ?? null;
    return { header, details, billing, bill };
  }

  async headerTaxValues(id: number): Promise<{ iva: number; spa: number; ivaSpa: number } | null> {
    const rows = await this.db.execute<(RowDataPacket & { iva: number | null; spa: number | null; ivaSpa: number | null })[]>(
      `SELECT psex_iva AS iva, psex_spa AS spa, psex_ivaspa AS ivaSpa FROM presup_prode WHERE psex_id = ? LIMIT 1`,
      [id],
    );
    const row = rows[0];
    return row ? { iva: Number(row.iva ?? 0), spa: Number(row.spa ?? 0), ivaSpa: Number(row.ivaSpa ?? 0) } : null;
  }

  async incentives(clientId: number, providerId: number, serviceId: number): Promise<IncentiveRow[]> {
    return this.db.execute<IncentiveRow[]>(`SELECT id, costo, utilidad_sono AS utilidadSono, utilidad_proveedor AS utilidadProveedor, area, medio, detalle, nota FROM sys_micro_servicio_incentivos WHERE id_cliente = ? AND id_proveedor = ? AND id_servicio = ? ORDER BY area, medio`, [clientId, providerId, serviceId]);
  }

  async orders(id?: number): Promise<OrderRow[]> {
    const params = id ? [this.tpoDoc, id] : [this.tpoDoc];
    return this.db.execute<OrderRow[]>(`SELECT o.ord_id AS id, o.ord_fecha AS fecha, o.ord_fechaimp AS fechaImp, p.nombre AS proveedor, o.ord_observacion AS observacion, o.num_impresiones AS numImpresiones FROM ordenes o LEFT JOIN sys_clients p ON o.pvcl_id_prov = p.id_client WHERE o.tpo_doc = ? ${id ? 'AND o.doc_id = ?' : ''} ORDER BY o.ord_id DESC LIMIT ${id ? 50 : 200}`, params);
  }

  async legacyButtonPermissions(roleId: number): Promise<Set<string>> {
    const rows = await this.db.execute<LegacyButtonPermissionRow[]>(`SELECT b.name FROM sys_roles_button r INNER JOIN sys_button b ON b.id_button = r.id_button WHERE b.application = 'EXTERNA' AND r.id_rol = ?`, [roleId]);
    return new Set(rows.map((row) => row.name));
  }

  async supportAttachments(id: number): Promise<SupportAttachmentRow[]> {
    return this.db.execute<SupportAttachmentRow[]>(`SELECT ppto, modulo, nombre, fecha FROM sys_adjunto_ppto WHERE ppto = ? AND modulo = ? ORDER BY fecha DESC, nombre`, [id, this.type]);
  }

  async supportBudget(id: number): Promise<SupportBudgetRow | null> {
    const rows = await this.db.execute<SupportBudgetRow[]>(`SELECT p.psex_id AS id, p.psex_estado AS idEstado, e.est_nombre AS estado FROM presup_prode p LEFT JOIN cat_estados e ON p.psex_estado = e.est_id WHERE p.psex_id = ? LIMIT 1`, [id]);
    return rows[0] ?? null;
  }

  async supportAttachment(id: number, filename: string): Promise<SupportAttachmentRow | null> {
    const rows = await this.db.execute<SupportAttachmentRow[]>(`SELECT ppto, modulo, nombre, fecha FROM sys_adjunto_ppto WHERE ppto = ? AND modulo = ? AND nombre = ? ORDER BY fecha DESC LIMIT 1`, [id, this.type, filename]);
    return rows[0] ?? null;
  }

  async addSupportAttachment(id: number, filename: string): Promise<void> {
    await this.db.execute<ResultSetHeader>(`INSERT INTO sys_adjunto_ppto (nombre, ppto, modulo, fecha) VALUES (?, ?, ?, CURDATE())`, [filename, id, this.type]);
  }

  async deleteSupportAttachment(id: number, filename: string): Promise<void> {
    await this.db.execute<ResultSetHeader>(`DELETE FROM sys_adjunto_ppto WHERE ppto = ? AND modulo = ? AND nombre = ?`, [id, this.type, filename]);
  }

  async updateOrderNumber(id: number, order: string | null): Promise<'ok' | 'not-found' | 'invalid-state'> {
    return this.db.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number })[]>(`SELECT psex_estado AS state FROM presup_prode WHERE psex_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      if (![this.active, this.printed].includes(Number(rows[0].state))) return 'invalid-state';
      await connection.execute<ResultSetHeader>(`UPDATE presup_prode SET psex_numorden = ? WHERE psex_id = ?`, [order, id]);
      return 'ok';
    });
  }

  async create(userId: number, payload: any): Promise<number | 'sequence-not-found'> {
    return this.db.transaction(async (connection) => {
      const [seq] = await connection.execute<(RowDataPacket & { consecutivo: number })[]>(`SELECT consecutivo FROM sys_consecutivos WHERE tipo = 'presupuesto' FOR UPDATE`);
      if (seq.length !== 1) return 'sequence-not-found';
      const id = Number(seq[0].consecutivo ?? 0) + 1;
      await connection.execute<ResultSetHeader>(`INSERT INTO presup_prode (psex_id, psex_fecha, presup_fechacrea, psex_estado, usr_id_crea, usr_id_mod, pvcl_id_clie, pvcl_id_prov, camp_id, pdcl_id, tpsv_id, contrato, psex_numorden, psex_formapago, psex_numcotizacion, psex_observacion, psex_desc, psex_iva, psex_spa, psex_ivaspa, psex_valor, psex_total, incentivo_x_servicio, num_impresiones, cargado) VALUES (?, CURDATE(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, -1, 0)`, [id, this.active, userId, userId, payload.idCliente, payload.idProveedor, payload.idCampana, payload.idProducto, payload.idServicio, payload.contrato, payload.ordenCliente, payload.formaPago, payload.cotizacion, payload.observacion, payload.descuento, payload.iva, payload.spa, payload.ivaSpa]);
      await connection.execute<ResultSetHeader>(`INSERT INTO ordenes (doc_id, ord_fecha, usr_id, num_impresiones, ord_fechaimp, tpo_doc, pvcl_id_prov, ord_observacion) VALUES (?, CURDATE(), ?, -1, CURDATE(), ?, ?, ?)`, [id, userId, this.tpoDoc, payload.idProveedor, payload.ordenObservacion]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_consecutivos SET consecutivo = ? WHERE tipo = 'presupuesto'`, [id]);
      return id;
    });
  }

  async update(id: number, userId: number, payload: any): Promise<'ok' | 'not-found' | 'not-active'> {
    return this.db.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { id: number; state: number })[]>(`SELECT psex_id AS id, psex_estado AS state FROM presup_prode WHERE psex_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      if (Number(rows[0].state) !== this.active) return 'not-active';
      await connection.execute<ResultSetHeader>(`UPDATE presup_prode SET usr_id_mod = ?, pvcl_id_clie = ?, pvcl_id_prov = ?, camp_id = ?, pdcl_id = ?, tpsv_id = ?, contrato = ?, psex_numorden = ?, psex_formapago = ?, psex_numcotizacion = ?, psex_observacion = ?, psex_desc = ?, psex_iva = ?, psex_spa = ?, psex_ivaspa = ? WHERE psex_id = ?`, [userId, payload.idCliente, payload.idProveedor, payload.idCampana, payload.idProducto, payload.idServicio, payload.contrato, payload.ordenCliente, payload.formaPago, payload.cotizacion, payload.observacion, payload.descuento, payload.iva, payload.spa, payload.ivaSpa, id]);
      const [orderUpdate] = await connection.execute<ResultSetHeader>(`UPDATE ordenes SET pvcl_id_prov = ?, ord_observacion = ? WHERE doc_id = ? AND tpo_doc = ?`, [payload.idProveedor, payload.ordenObservacion, id, this.tpoDoc]);
      if (orderUpdate.affectedRows === 0) await connection.execute<ResultSetHeader>(`INSERT INTO ordenes (doc_id, ord_fecha, usr_id, num_impresiones, ord_fechaimp, tpo_doc, pvcl_id_prov, ord_observacion) VALUES (?, CURDATE(), ?, -1, CURDATE(), ?, ?, ?)`, [id, userId, this.tpoDoc, payload.idProveedor, payload.ordenObservacion]);
      await this.recalc(connection, id);
      return 'ok';
    });
  }

  async saveDetail(budgetId: number, detailId: number | null, payload: any): Promise<'ok' | 'not-found' | 'not-active' | 'incentive-not-found'> {
    return this.db.transaction(async (connection) => {
      const [headers] = await connection.execute<(RowDataPacket & { id: number; state: number; fecha: Date | string; idCliente: number; idProveedor: number })[]>(`SELECT psex_id AS id, psex_estado AS state, psex_fecha AS fecha, pvcl_id_clie AS idCliente, pvcl_id_prov AS idProveedor FROM presup_prode WHERE psex_id = ? FOR UPDATE`, [budgetId]);
      const header = headers[0];
      if (!header) return 'not-found';
      if (Number(header.state) !== this.active) return 'not-active';
      let incentive: IncentiveRow | null = null;
      if (payload.incentivo > 0) {
        incentive = await this.findMatchingIncentive(connection, payload.incentivo, header.idCliente, header.idProveedor, payload.idServicio);
        if (!incentive) return 'incentive-not-found';
      }
      let id = detailId;
      if (detailId) {
        const [details] = await connection.execute<DetailRow[]>(`SELECT dprode_id AS id FROM det_prode WHERE psex_id = ? AND dprode_id = ? FOR UPDATE`, [budgetId, detailId]);
        if (!details[0]) return 'not-found';
        await connection.execute<ResultSetHeader>(`UPDATE det_prode SET unidad = ?, tpsv_id = ?, dprode_detalle = ?, dprode_valor = ?, dprode_iva = ?, incentivo = ? WHERE psex_id = ? AND dprode_id = ?`, [payload.unidad, payload.idServicio, payload.detalle, payload.valor, payload.iva, payload.incentivo || 0, budgetId, detailId]);
      } else {
        const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO det_prode (psex_id, unidad, tpsv_id, dprode_detalle, dprode_valor, dprode_iva, incentivo) VALUES (?, ?, ?, ?, ?, ?, ?)`, [budgetId, payload.unidad, payload.idServicio, payload.detalle, payload.valor, payload.iva, payload.incentivo || 0]);
        id = result.insertId;
      }
      await connection.execute<ResultSetHeader>(`DELETE FROM sys_detalle_micro_servicio_incentivos WHERE ppto = ? AND det_ppto = ? AND tipo_ppto = ?`, [budgetId, id, this.type]);
      if (incentive) await this.saveIncentiveSnapshot(connection, budgetId, id!, header.fecha, payload.idServicio, payload.valor, incentive, payload.costoIncentivo);
      await this.recalc(connection, budgetId);
      return 'ok';
    });
  }

  async deleteDetail(budgetId: number, detailId: number, userId: number): Promise<'ok' | 'not-found' | 'not-active' | 'cost-order-link-unavailable'> {
    return this.db.transaction(async (connection) => {
      const [headers] = await connection.execute<(RowDataPacket & { state: number })[]>(`SELECT psex_estado AS state FROM presup_prode WHERE psex_id = ? FOR UPDATE`, [budgetId]);
      if (!headers[0]) return 'not-found';
      if (Number(headers[0].state) !== this.active) return 'not-active';
      const [detailRows] = await connection.execute<DetailRow[]>(`SELECT dprode_id AS id FROM det_prode WHERE psex_id = ? AND dprode_id = ? FOR UPDATE`, [budgetId, detailId]);
      if (!detailRows[0]) return 'not-found';
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
      const [result] = await connection.execute<ResultSetHeader>(`DELETE FROM det_prode WHERE psex_id = ? AND dprode_id = ?`, [budgetId, detailId]);
      if (result.affectedRows !== 1) return 'not-found';
      await connection.execute<ResultSetHeader>(`DELETE FROM sys_detalle_micro_servicio_incentivos WHERE ppto = ? AND det_ppto = ? AND tipo_ppto = ?`, [budgetId, detailId, this.type]);
      await this.recalc(connection, budgetId);
      for (const orderId of orderIds) await this.recalcCostOrder(connection, orderId, userId);
      return 'ok';
    });
  }

  async costOrderDetails(budgetId: number, orderId: number): Promise<CostOrderDetailRow[] | 'not-found' | 'not-active' | 'order-unavailable' | 'type-mismatch' | 'iva-mismatch'> {
    return this.db.transaction(async (connection) => {
      const [budgets] = await connection.execute<(RowDataPacket & { id: number; state: number; idCliente: number; idProveedor: number; iva: number | null })[]>(`SELECT psex_id AS id, psex_estado AS state, pvcl_id_clie AS idCliente, pvcl_id_prov AS idProveedor, psex_iva AS iva FROM presup_prode WHERE psex_id = ?`, [budgetId]);
      const budget = budgets[0];
      if (!budget) return 'not-found';
      if (Number(budget.state) !== this.active) return 'not-active';
      const [orders] = await connection.execute<(RowDataPacket & { id: number; state: number; idCliente: number; idProveedor: number; tipo: string | null; tipoPpto: number | null; iva: number | null })[]>(`SELECT id_orden AS id, id_estado AS state, id_cliente AS idCliente, id_proveedor AS idProveedor, tipo, tipo_ppto AS tipoPpto, porc_iva AS iva FROM sys_orden_costos WHERE id_orden = ?`, [orderId]);
      const order = orders[0];
      if (!order || [this.config.costOrderStatuses.canceled, this.config.costOrderStatuses.finalized, this.config.costOrderStatuses.pending].includes(Number(order.state))) return 'order-unavailable';
      if (Number(order.idCliente) !== Number(budget.idCliente) || Number(order.idProveedor) !== Number(budget.idProveedor)) return 'order-unavailable';
      if (String(order.tipo || '').toUpperCase() !== 'E' || (order.tipoPpto !== null && Number(order.tipoPpto) !== this.type)) return 'type-mismatch';
      if (order.iva !== null && budget.iva !== null && Math.abs(Number(order.iva) - Number(budget.iva)) > 0.0001) return 'iva-mismatch';
      const [rows] = await connection.execute<CostOrderDetailRow[]>(`SELECT d.id_orden AS idOrden, d.id_detalle AS idDetalle, d.detalle, d.total, d.total_cobrado AS totalCobrado, GREATEST(COALESCE(d.total, 0) - COALESCE(d.total_cobrado, 0), 0) AS disponible FROM sys_detalle_costo d WHERE d.id_orden = ? AND GREATEST(COALESCE(d.total, 0) - COALESCE(d.total_cobrado, 0), 0) > 0 ORDER BY d.id_detalle`, [orderId]);
      return rows;
    });
  }

  async addCostOrderDetail(budgetId: number, orderId: number, orderDetailId: number, assigned: number, userId: number, defaultIva: number, incentivePayload: { incentivo: number; costoIncentivo?: number }): Promise<number | 'not-found' | 'not-active' | 'order-unavailable' | 'detail-unavailable' | 'incentive-not-found' | 'type-mismatch' | 'iva-mismatch' | 'unavailable'> {
    return this.db.transaction(async (connection) => {
      const [budgets] = await connection.execute<(RowDataPacket & { id: number; state: number; fecha: Date | string; idCliente: number; idProveedor: number; idServicio: number | null; iva: number | null })[]>(`SELECT psex_id AS id, psex_estado AS state, psex_fecha AS fecha, pvcl_id_clie AS idCliente, pvcl_id_prov AS idProveedor, tpsv_id AS idServicio, psex_iva AS iva FROM presup_prode WHERE psex_id = ? FOR UPDATE`, [budgetId]);
      const budget = budgets[0];
      if (!budget) return 'not-found';
      if (Number(budget.state) !== this.active) return 'not-active';
      const [orders] = await connection.execute<(RowDataPacket & { id: number; state: number; idCliente: number; idProveedor: number; tipo: string | null; tipoPpto: number | null; iva: number | null })[]>(`SELECT id_orden AS id, id_estado AS state, id_cliente AS idCliente, id_proveedor AS idProveedor, tipo, tipo_ppto AS tipoPpto, porc_iva AS iva FROM sys_orden_costos WHERE id_orden = ? FOR UPDATE`, [orderId]);
      const order = orders[0];
      if (!order || [this.config.costOrderStatuses.canceled, this.config.costOrderStatuses.finalized, this.config.costOrderStatuses.pending].includes(Number(order.state))) return 'order-unavailable';
      if (Number(order.idCliente) !== Number(budget.idCliente) || Number(order.idProveedor) !== Number(budget.idProveedor)) return 'order-unavailable';
      if (String(order.tipo || '').toUpperCase() !== 'E' || (order.tipoPpto !== null && Number(order.tipoPpto) !== this.type)) return 'type-mismatch';
      if (order.iva !== null && budget.iva !== null && Math.abs(Number(order.iva) - Number(budget.iva)) > 0.0001) return 'iva-mismatch';
      if (!budget.idServicio) return 'not-found';
      let incentive: IncentiveRow | null = null;
      if (incentivePayload.incentivo > 0) {
        incentive = await this.findMatchingIncentive(connection, incentivePayload.incentivo, budget.idCliente, budget.idProveedor, Number(budget.idServicio));
        if (!incentive) return 'incentive-not-found';
      }
      const [details] = await connection.execute<(RowDataPacket & { idDetalle: number; detalle: string | null; total: number | null; totalCobrado: number | null; disponible: number | null })[]>(`SELECT id_detalle AS idDetalle, detalle, total, total_cobrado AS totalCobrado, GREATEST(COALESCE(total, 0) - COALESCE(total_cobrado, 0), 0) AS disponible FROM sys_detalle_costo WHERE id_orden = ? AND id_detalle = ? FOR UPDATE`, [orderId, orderDetailId]);
      const detail = details[0];
      if (!detail) return 'detail-unavailable';
      if (assigned <= 0 || Number(detail.disponible ?? 0) + 0.0001 < assigned) return 'unavailable';
      const [orderDetailUpdate] = await connection.execute<ResultSetHeader>(`UPDATE sys_detalle_costo SET total_cobrado = COALESCE(total_cobrado, 0) + ? WHERE id_orden = ? AND id_detalle = ? AND GREATEST(COALESCE(total, 0) - COALESCE(total_cobrado, 0), 0) >= ?`, [assigned, orderId, orderDetailId, assigned]);
      if (orderDetailUpdate.affectedRows !== 1) return 'unavailable';
      const [insert] = await connection.execute<ResultSetHeader>(`INSERT INTO det_prode (psex_id, unidad, tpsv_id, dprode_detalle, dprode_valor, dprode_iva, incentivo, valor_asignado_oc, ordcos_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [budgetId, '1', budget.idServicio, detail.detalle || '', assigned, budget.iva ?? defaultIva, incentivePayload.incentivo || 0, assigned, orderId]);
      if (incentive) await this.saveIncentiveSnapshot(connection, budgetId, insert.insertId, budget.fecha, Number(budget.idServicio), assigned, incentive, incentivePayload.costoIncentivo);
      await connection.execute<ResultSetHeader>(`INSERT INTO sys_oc_ppto (id_orden, id_ppto, id_detalle_ppto, id_detalle_orden, modulo, cobrado_item) VALUES (?, ?, ?, ?, ?, ?)`, [orderId, budgetId, insert.insertId, orderDetailId, this.type, assigned]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_orden_costos SET tipo_ppto = CASE WHEN tipo_ppto IS NULL THEN ? ELSE tipo_ppto END WHERE id_orden = ?`, [this.type, orderId]);
      await this.recalc(connection, budgetId);
      await this.recalcCostOrder(connection, orderId, userId);
      return insert.insertId;
    });
  }

  async markPrinted(id: number): Promise<'ok' | 'already-printed' | 'not-found' | 'skipped-state'> {
    return this.db.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number; prints: number | null })[]>(`SELECT p.psex_estado AS state, p.num_impresiones AS prints FROM presup_prode p WHERE p.psex_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      if (Number(rows[0].state) === this.printed) return 'already-printed';
      if (Number(rows[0].state) !== this.active) return 'skipped-state';
      await connection.execute<ResultSetHeader>(`UPDATE presup_prode SET psex_estado = ?, num_impresiones = COALESCE(num_impresiones, -1) + 1 WHERE psex_id = ?`, [this.printed, id]);
      return 'ok';
    });
  }

  async anule(id: number, userId: number, observation: string | null): Promise<'ok' | 'not-found' | 'invalid-state' | 'has-bill' | 'sequence-not-found' | 'requires-observation' | 'cost-order-link-unavailable'> {
    return this.db.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { state: number; prints: number | null })[]>(`SELECT psex_estado AS state, num_impresiones AS prints FROM presup_prode WHERE psex_id = ? FOR UPDATE`, [id]);
      if (!rows[0]) return 'not-found';
      const state = Number(rows[0].state);
      const prints = Number(rows[0].prints ?? -1);
      if (!((state === this.active && prints === -1) || state === this.printed)) return 'invalid-state';
      const [bill] = await connection.execute<CountRow[]>(`SELECT COUNT(*) AS total FROM factura_presup WHERE id_doc = ? AND modulo_id = ?`, [id, this.type]);
      if (Number(bill[0]?.total ?? 0) > 0) return 'has-bill';
      const [seq] = await connection.execute<(RowDataPacket & { consecutivo: number })[]>(`SELECT consecutivo FROM sys_consecutivos WHERE tipo = 'anulacion_ppto' FOR UPDATE`);
      if (seq.length !== 1) return 'sequence-not-found';
      const next = Number(seq[0].consecutivo ?? 0) + 1;
      const [links] = await connection.execute<(RowDataPacket & { idOrden: number; idDetallePpto: number; idDetalleOrden: number; cobradoItem: number | null })[]>(`SELECT id_orden AS idOrden, id_detalle_ppto AS idDetallePpto, id_detalle_orden AS idDetalleOrden, cobrado_item AS cobradoItem FROM sys_oc_ppto WHERE id_ppto = ? AND modulo = ? FOR UPDATE`, [id, this.type]);
      if (links.length > 0 && !observation) return 'requires-observation';
      const orderIds = new Set<number>();
      const budgetDetailIds = new Set<number>();
      const orderDetailCharges = new Map<string, { orderId: number; detailId: number; amount: number }>();
      for (const link of links) {
        const orderId = Number(link.idOrden);
        const budgetDetailId = Number(link.idDetallePpto);
        const orderDetailId = Number(link.idDetalleOrden);
        orderIds.add(orderId);
        budgetDetailIds.add(budgetDetailId);
        const orderDetailKey = `${orderId}:${orderDetailId}`;
        const currentCharge = orderDetailCharges.get(orderDetailKey);
        orderDetailCharges.set(orderDetailKey, {
          orderId,
          detailId: orderDetailId,
          amount: (currentCharge?.amount ?? 0) + Number(link.cobradoItem ?? 0),
        });
        const [budgetDetail] = await connection.execute<(RowDataPacket & { id: number })[]>(`SELECT dprode_id AS id FROM det_prode WHERE psex_id = ? AND dprode_id = ? FOR UPDATE`, [id, link.idDetallePpto]);
        if (budgetDetail.length !== 1) return 'cost-order-link-unavailable';
        const [orderDetail] = await connection.execute<(RowDataPacket & { id: number })[]>(`SELECT id_detalle AS id FROM sys_detalle_costo WHERE id_orden = ? AND id_detalle = ? FOR UPDATE`, [link.idOrden, link.idDetalleOrden]);
        if (orderDetail.length !== 1) return 'cost-order-link-unavailable';
      }
      for (const orderId of orderIds) {
        const [order] = await connection.execute<(RowDataPacket & { id: number })[]>(`SELECT id_orden AS id FROM sys_orden_costos WHERE id_orden = ? FOR UPDATE`, [orderId]);
        if (order.length !== 1) return 'cost-order-link-unavailable';
      }
      for (const charge of orderDetailCharges.values()) {
        await connection.execute<ResultSetHeader>(`UPDATE sys_detalle_costo SET total_cobrado = GREATEST(COALESCE(total_cobrado, 0) - ?, 0) WHERE id_orden = ? AND id_detalle = ?`, [charge.amount, charge.orderId, charge.detailId]);
      }
      await connection.execute<ResultSetHeader>(`DELETE FROM sys_oc_ppto WHERE id_ppto = ? AND modulo = ?`, [id, this.type]);
      for (const budgetDetailId of budgetDetailIds) {
        await connection.execute<ResultSetHeader>(
          `UPDATE det_prode
           SET valor_asignado_oc = (SELECT COALESCE(SUM(p.cobrado_item), 0) FROM sys_oc_ppto p WHERE p.modulo = ? AND p.id_detalle_ppto = det_prode.dprode_id),
               ordcos_id = (SELECT MIN(p.id_orden) FROM sys_oc_ppto p WHERE p.modulo = ? AND p.id_detalle_ppto = det_prode.dprode_id)
           WHERE dprode_id = ? AND psex_id = ?`,
          [this.type, this.type, budgetDetailId, id],
        );
      }
      for (const orderId of orderIds) {
        await connection.execute<ResultSetHeader>(`UPDATE sys_orden_costos SET cobrado = (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), faltante = GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0), tipo_ppto = CASE WHEN EXISTS (SELECT 1 FROM sys_oc_ppto WHERE id_orden = ?) THEN tipo_ppto ELSE NULL END, id_estado = CASE WHEN id_estado = ? AND GREATEST(valor - (SELECT COALESCE(SUM(total_cobrado), 0) FROM sys_detalle_costo WHERE id_orden = ?), 0) > 0 THEN ? ELSE id_estado END, id_usuario_mod = ?, fecha_mod = NOW() WHERE id_orden = ?`, [orderId, orderId, orderId, this.config.costOrderStatuses.finalized, orderId, this.config.costOrderStatuses.printed, userId, orderId]);
      }
      await connection.execute<ResultSetHeader>(`UPDATE presup_prode SET psex_estado = ?, usr_id_mod = ?, fecha_anulacion = CURDATE(), consecutivo_anulacion = ?, psex_observacion = CASE WHEN ? IS NULL THEN psex_observacion ELSE ? END WHERE psex_id = ?`, [this.cancelled, userId, next, observation, observation, id]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_consecutivos SET consecutivo = ? WHERE tipo = 'anulacion_ppto'`, [next]);
      return 'ok';
    });
  }

  async duplicate(id: number, userId: number): Promise<number | 'not-found' | 'sequence-not-found'> {
    return this.db.transaction(async (connection) => {
      const [source] = await connection.execute<(RowDataPacket & { id: number })[]>(`SELECT psex_id AS id FROM presup_prode WHERE psex_id = ? FOR UPDATE`, [id]);
      if (source.length !== 1) return 'not-found';
      const [seq] = await connection.execute<(RowDataPacket & { consecutivo: number })[]>(`SELECT consecutivo FROM sys_consecutivos WHERE tipo = 'presupuesto' FOR UPDATE`);
      if (seq.length !== 1) return 'sequence-not-found';
      const newId = Number(seq[0].consecutivo ?? 0) + 1;
      const [insert] = await connection.execute<ResultSetHeader>(`INSERT INTO presup_prode (psex_id, psex_fecha, presup_fechacrea, psex_estado, usr_id_crea, usr_id_mod, pvcl_id_clie, pvcl_id_prov, camp_id, pdcl_id, tpsv_id, contrato, psex_numorden, psex_formapago, psex_numcotizacion, psex_observacion, psex_desc, psex_iva, psex_spa, psex_ivaspa, psex_valor, psex_total, incentivo_x_servicio, num_impresiones, cargado) SELECT ?, CURDATE(), NOW(), ?, ?, ?, pvcl_id_clie, pvcl_id_prov, camp_id, pdcl_id, tpsv_id, contrato, psex_numorden, psex_formapago, psex_numcotizacion, CONCAT(COALESCE(psex_observacion, ''), ' Duplicado del Presupuesto ', psex_id), psex_desc, psex_iva, psex_spa, psex_ivaspa, psex_valor, psex_total, incentivo_x_servicio, -1, 0 FROM presup_prode WHERE psex_id = ?`, [newId, this.active, userId, userId, id]);
      if (insert.affectedRows !== 1) return 'not-found';
      await connection.execute<ResultSetHeader>(`INSERT INTO det_prode (psex_id, dprode_detalle, dprode_valor, dprode_iva, tpsv_id, unidad, ivaItem, incentivo) SELECT ?, dprode_detalle, dprode_valor, dprode_iva, tpsv_id, unidad, ivaItem, incentivo FROM det_prode WHERE psex_id = ?`, [newId, id]);
      await connection.execute<ResultSetHeader>(`INSERT INTO sys_detalle_micro_servicio_incentivos (ppto, det_ppto, fecha_ppto, tipo_ppto, costo, valor, utilidad_sono, utilidad_proveedor, detalle, nota, medio, area, id_servicio) SELECT ?, nd.dprode_id, CURDATE(), ?, mi.costo, nd.dprode_valor, mi.utilidad_sono, mi.utilidad_proveedor, mi.detalle, mi.nota, mi.medio, mi.area, nd.tpsv_id FROM det_prode nd INNER JOIN sys_micro_servicio_incentivos mi ON nd.incentivo = mi.id WHERE nd.psex_id = ? AND COALESCE(nd.incentivo, 0) > 0`, [newId, this.type, newId]);
      await connection.execute<ResultSetHeader>(`INSERT INTO ordenes (doc_id, ord_fecha, usr_id, ord_fechaimp, tpo_doc, ord_observacion, pvcl_id_prov, num_impresiones) SELECT ?, CURDATE(), ?, CURDATE(), tpo_doc, CONCAT(COALESCE(ord_observacion, ''), ' Duplicado de la orden ', ord_id), pvcl_id_prov, -1 FROM ordenes WHERE doc_id = ? AND tpo_doc = ?`, [newId, userId, id, this.tpoDoc]);
      await connection.execute<ResultSetHeader>(`UPDATE sys_consecutivos SET consecutivo = ? WHERE tipo = 'presupuesto'`, [newId]);
      return newId;
    });
  }

  async replace(id: number, userId: number): Promise<number | 'not-found' | 'invalid-state' | 'sequence-not-found'> {
    return this.db.transaction(async (connection) => {
      const [source] = await connection.execute<(RowDataPacket & { id: number; state: number })[]>(`SELECT psex_id AS id, psex_estado AS state FROM presup_prode WHERE psex_id = ? FOR UPDATE`, [id]);
      if (source.length !== 1) return 'not-found';
      if (Number(source[0].state) !== this.creditNote) return 'invalid-state';
      const [seq] = await connection.execute<(RowDataPacket & { consecutivo: number })[]>(`SELECT consecutivo FROM sys_consecutivos WHERE tipo = 'presupuesto' FOR UPDATE`);
      if (seq.length !== 1) return 'sequence-not-found';
      const newId = Number(seq[0].consecutivo ?? 0) + 1;
      const [insert] = await connection.execute<ResultSetHeader>(`INSERT INTO presup_prode (psex_id, psex_fecha, presup_fechacrea, psex_estado, usr_id_crea, usr_id_mod, pvcl_id_clie, pvcl_id_prov, camp_id, pdcl_id, tpsv_id, contrato, psex_numorden, psex_formapago, psex_numcotizacion, psex_observacion, psex_desc, psex_iva, psex_spa, psex_ivaspa, psex_valor, psex_total, incentivo_x_servicio, num_impresiones, cargado) SELECT ?, CURDATE(), NOW(), ?, ?, ?, pvcl_id_clie, pvcl_id_prov, camp_id, pdcl_id, tpsv_id, contrato, psex_numorden, psex_formapago, psex_numcotizacion, CONCAT(' Reemplazo del Presupuesto ', psex_id), psex_desc, psex_iva, psex_spa, psex_ivaspa, psex_valor, psex_total, incentivo_x_servicio, -1, 0 FROM presup_prode WHERE psex_id = ?`, [newId, this.active, userId, userId, id]);
      if (insert.affectedRows !== 1) return 'not-found';
      const [oldDetails] = await connection.execute<(RowDataPacket & { oldId: number; newId: number })[]>(`SELECT dprode_id AS oldId, 0 AS newId FROM det_prode WHERE psex_id = ? ORDER BY dprode_id`, [id]);
      for (const detail of oldDetails) {
        const [detailInsert] = await connection.execute<ResultSetHeader>(`INSERT INTO det_prode (psex_id, dprode_detalle, dprode_valor, dprode_iva, tpsv_id, unidad, id_copy, ivaItem, valor_asignado_oc, ordcos_id, incentivo) SELECT ?, dprode_detalle, dprode_valor, dprode_iva, tpsv_id, unidad, dprode_id, ivaItem, valor_asignado_oc, ordcos_id, incentivo FROM det_prode WHERE psex_id = ? AND dprode_id = ?`, [newId, id, detail.oldId]);
        await connection.execute<ResultSetHeader>(`UPDATE sys_oc_ppto SET id_ppto = ?, id_detalle_ppto = ? WHERE id_detalle_ppto = ? AND modulo = ?`, [newId, detailInsert.insertId, detail.oldId, this.type]);
      }
      await connection.execute<ResultSetHeader>(`INSERT INTO ordenes (doc_id, ord_fecha, usr_id, ord_fechaimp, tpo_doc, ord_observacion, pvcl_id_prov, num_impresiones) SELECT ?, CURDATE(), ?, CURDATE(), tpo_doc, CONCAT(COALESCE(ord_observacion, ''), ' Reemplazo de la orden ', ord_id), pvcl_id_prov, -1 FROM ordenes WHERE doc_id = ? AND tpo_doc = ?`, [newId, userId, id, this.tpoDoc]);
      const [linkedOrders] = await connection.execute<(RowDataPacket & { idOrden: number })[]>(`SELECT DISTINCT id_orden AS idOrden FROM sys_oc_ppto WHERE id_ppto = ? AND modulo = ?`, [newId, this.type]);
      for (const row of linkedOrders) {
        await connection.execute<ResultSetHeader>(`UPDATE sys_orden_costos SET notas = GREATEST(COALESCE(notas, 0) - 1, 0), id_estado = CASE WHEN GREATEST(COALESCE(notas, 0) - 1, 0) = 0 THEN ? ELSE id_estado END WHERE id_orden = ?`, [this.config.costOrderStatuses.printed, row.idOrden]);
      }
      await connection.execute<ResultSetHeader>(`UPDATE sys_consecutivos SET consecutivo = ? WHERE tipo = 'presupuesto'`, [newId]);
      return newId;
    });
  }
}
