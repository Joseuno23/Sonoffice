// Order / user data + generators shared by the API routes.

const CLIENTS = ['Carnes Frías Zenú', 'Postobón', 'Grupo Éxito', 'Bavaria', 'Alpina', 'Nutresa', 'Colombina', 'Familia', 'Ramo', 'Quala', 'Corona', 'Sura'];
const REFS = ['POP Carnes Frías 2026', 'Rebranding empaques premium', 'Campaña temporada navideña', 'Material punto de venta Q3', 'Catálogo institucional 2026', 'Señalética corporativa sedes', 'Display promocional góndola', 'Kit de lanzamiento de producto', 'Volantes ruta comercial', 'Adhesivos línea saludable'];
const RESPS = ['Omar Salas', 'Laura Méndez', 'Carlos Ruiz', 'Andrea Gómez', 'Diego Torres', 'Paula Ríos'];
const ESTADOS = ['Activo', 'En proceso', 'Pendiente', 'Cerrado', 'Anulado'];

export function generateOrders() {
  const out = [];
  for (let i = 0; i < 26; i++) {
    const est = ESTADOS[(i * 3 + (i % 5)) % 5];
    const dt = new Date(2026, 5 - (i % 6), 28 - (i % 25));
    out.push({
      id: 'OP-2026-' + String(1042 - i),
      cliente: CLIENTS[i % CLIENTS.length],
      ref: REFS[i % REFS.length],
      resp: RESPS[i % RESPS.length],
      fecha: dt.toISOString(),
      estado: est,
      avance: est === 'Cerrado' ? 100 : est === 'Anulado' ? 0 : est === 'Pendiente' ? 8 + (i * 3) % 22 : 32 + (i * 7) % 56,
      valor: (8 + (i * 13) % 42) * 1000000 + (i % 9) * 250000,
    });
  }
  return out;
}

// Rich detail payload (matches the prototype's static detail view).
export function orderDetail(id) {
  const base = generateOrders().find((o) => o.id === id) || generateOrders()[0];
  return {
    id: base.id,
    cliente: base.cliente,
    estado: base.estado,
    emision: '12 May 2024',
    vencimiento: '26 May 2024',
    total: 'USD 24,560',
    conceptos: [
      { desc: 'Servicio de consultoría empresarial', qty: '40', price: 'USD 350', amount: 'USD 14,000' },
      { desc: 'Licencia de software anual', qty: '5', price: 'USD 1,200', amount: 'USD 6,000' },
      { desc: 'Implementación y capacitación', qty: '1', price: 'USD 4,560', amount: 'USD 4,560' },
    ],
    subtotal: 'USD 24,560',
    iva: 'USD 3,930',
    totalImp: 'USD 28,490',
    email: 'contacto@comnorte.com',
    phone: '+52 55 1234 5678',
    address: 'Av. Reforma 245, CDMX, México',
    docs: [
      { name: 'Factura F-2034.pdf', meta: 'PDF · 240 KB' },
      { name: 'Orden de compra cliente.pdf', meta: 'PDF · 240 KB' },
      { name: 'Contrato de servicio.pdf', meta: 'PDF · 240 KB' },
    ],
  };
}

export const USERS = [
  { name: 'Jose Narvaez', email: 'jose.narvaez@sonovista.co', role: 'Administrador', active: true, last: 'Hace 2 min' },
  { name: 'Omar Salas', email: 'omar.salas@sonovista.co', role: 'Editor', active: true, last: 'Hace 1 h' },
  { name: 'Laura Méndez', email: 'laura.mendez@sonovista.co', role: 'Operador', active: true, last: 'Hoy, 09:14' },
  { name: 'Carlos Ruiz', email: 'carlos.ruiz@sonovista.co', role: 'Operador', active: false, last: '12 jun 2026' },
  { name: 'Andrea Gómez', email: 'andrea.gomez@sonovista.co', role: 'Editor', active: true, last: 'Ayer, 16:40' },
  { name: 'Diego Torres', email: 'diego.torres@sonovista.co', role: 'Consulta', active: true, last: 'Hace 3 h' },
  { name: 'Paula Ríos', email: 'paula.rios@sonovista.co', role: 'Operador', active: true, last: 'Hoy, 08:02' },
  { name: 'Miguel Peña', email: 'miguel.pena@sonovista.co', role: 'Consulta', active: false, last: '28 may 2026' },
  { name: 'Sofía Cárdenas', email: 'sofia.cardenas@sonovista.co', role: 'Administrador', active: true, last: 'Hace 40 min' },
  { name: 'Julián Vega', email: 'julian.vega@sonovista.co', role: 'Operador', active: true, last: 'Hoy, 07:55' },
];

export const ROLES = [
  { name: 'Administrador', count: 2, desc: 'Acceso total al sistema, configuración y gestión de usuarios.', perms: ['Todos los módulos', 'Configuración', 'Usuarios'] },
  { name: 'Editor', count: 4, desc: 'Crea y edita órdenes, cotizaciones y documentos.', perms: ['Órdenes', 'Cotizaciones', 'Documentos'] },
  { name: 'Operador', count: 6, desc: 'Ejecuta tareas y actualiza el avance de las órdenes.', perms: ['Órdenes', 'Hojas de tiempo'] },
  { name: 'Consulta', count: 9, desc: 'Acceso de solo lectura a reportes e indicadores.', perms: ['Solo lectura', 'Reportes'] },
];
