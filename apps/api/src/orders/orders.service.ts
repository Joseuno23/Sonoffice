import { Injectable } from '@nestjs/common';
import { generateOrders, orderDetail } from './data';

export interface Order {
  id: string;
  cliente: string;
  ref: string;
  resp: string;
  fecha: string;
  estado: string;
  avance: number;
  valor: number;
}

@Injectable()
export class OrdersService {
  // In-memory store, regenerated on boot. New orders are prepended.
  private orders: Order[] = generateOrders();

  findAll(): Order[] {
    return this.orders;
  }

  findOne(id: string) {
    return orderDetail(id);
  }

  create(body: any): Order {
    const next = 'OP-2026-' + String(1043 + (this.orders.length - 26));
    const estado =
      body?.estadoInicial === 'Confirmada'
        ? 'Activo'
        : body?.estadoInicial === 'Pagada'
        ? 'Cerrado'
        : 'Pendiente';
    const order: Order = {
      id: next,
      cliente: body?.cliente || 'Nuevo cliente',
      ref: body?.ref || 'Sin referencia',
      resp: body?.resp || 'Sin asignar',
      fecha: new Date().toISOString(),
      estado,
      avance: 0,
      valor: 0,
    };
    this.orders = [order, ...this.orders];
    return order;
  }
}
