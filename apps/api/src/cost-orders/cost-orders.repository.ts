import { Injectable } from '@nestjs/common';
import { PoolConnection } from 'mysql2/promise';
import { ResultSetHeader } from 'mysql2';
import { DbService } from '../db/db.service';
import {
  CostOrderCountRow,
  CostOrderDetailRow,
  CostOrderHeaderRow,
  CostOrderOptionRow,
  CostOrderRow,
} from './cost-orders.types';

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
  constructor(private readonly db: DbService) {}

  // Construye el WHERE dinámico con parámetros bindeados (arregla la SQL injection del legacy).
  private buildWhere(filters: CostOrderFilters): { clause: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters.search) {
      const like = `%${filters.search}%`;
      conditions.push(`(
        o.id_orden LIKE ? OR e.description LIKE ? OR p.nombre LIKE ?
        OR c.nombre LIKE ? OR ca.camp_nombre LIKE ? OR o.valor LIKE ?
      )`);
      params.push(like, like, like, like, like, like);
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
        o.valor AS valor
      ${FROM_JOINS}
      ${clause}
      ORDER BY o.id_orden DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return this.db.execute<CostOrderRow[]>(sql, params);
  }

  async countOrders(filters: CostOrderFilters): Promise<number> {
    const { clause, params } = this.buildWhere(filters);
    const sql = `SELECT COUNT(*) AS total ${FROM_JOINS} ${clause}`;
    const rows = await this.db.execute<CostOrderCountRow[]>(sql, params);
    return Number(rows[0]?.total ?? 0);
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
        o.porc_iva AS porcIva,
        o.porc_descuento AS porcDescuento,
        o.valor AS valor,
        o.total AS total,
        o.cobrado AS cobrado,
        o.faltante AS faltante,
        o.fecha AS fecha
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
        CASE WHEN COUNT(p.id_orden) > 0 THEN 1 ELSE 0 END AS hasBudget
      FROM sys_detalle_costo d
      LEFT JOIN sys_oc_ppto p ON p.id_detalle_orden = d.id_detalle
      WHERE d.id_orden = ?
      GROUP BY d.id_detalle
      ORDER BY d.id_detalle`,
      [id],
    );
  }

  // Actualiza cabecera + reemplaza líneas de detalle NO vinculadas a presupuesto, en una
  // transacción. Las líneas con sys_oc_ppto NO se tocan (se preservan para la Fase 2).
  async updateOrder(
    id: number,
    header: {
      idCliente: number; idProveedor: number; idProducto: number; idCampana: number;
      idServicio: number; observacion: string | null; porcIva: number; porcDescuento: number;
      valor: number; total: number; idUsuario: number;
    },
    details: NewCostOrderDetail[],
  ): Promise<void> {
    await this.db.transaction(async (connection: PoolConnection) => {
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

      await connection.execute<ResultSetHeader>(
        `UPDATE sys_orden_costos SET
          id_cliente = ?, id_proveedor = ?, id_producto = ?, id_campana = ?,
          id_servicio = ?, observacion = ?, porc_iva = ?, porc_descuento = ?,
          valor = ?, total = ?, faltante = valor - cobrado, id_usuario_mod = ?, fecha_mod = NOW()
        WHERE id_orden = ?`,
        [
          header.idCliente, header.idProveedor, header.idProducto, header.idCampana,
          header.idServicio, header.observacion, header.porcIva, header.porcDescuento,
          header.valor, header.total, header.idUsuario, id,
        ],
      );
    });
  }

  // Suma de totales de líneas CON presupuesto (para no perderlas al recalcular valor en update).
  async sumBudgetLineTotals(id: number): Promise<number> {
    const rows = await this.db.execute<CostOrderCountRow[]>(
      `SELECT COALESCE(SUM(d.total), 0) AS total
       FROM sys_detalle_costo d
       INNER JOIN sys_oc_ppto p ON p.id_detalle_orden = d.id_detalle
       WHERE d.id_orden = ?`,
      [id],
    );
    return Number(rows[0]?.total ?? 0);
  }

  // Inserta cabecera + detalle en una transacción y devuelve el id de la nueva orden.
  async createOrder(header: NewCostOrderHeader, details: NewCostOrderDetail[]): Promise<number> {
    return this.db.transaction(async (connection: PoolConnection) => {
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

      return orderId;
    });
  }
}
