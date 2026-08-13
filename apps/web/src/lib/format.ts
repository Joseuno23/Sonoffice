export function fmtDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Abreviado (para tablas / vistas compactas): $3.0M
export function fmtMoney(n) {
  return '$' + (n / 1e6).toFixed(1) + 'M';
}

// Completo (para creación/edición): $3.000.000,00 (formato es-CO)
export function fmtMoneyFull(n) {
  const value = Number(n) || 0;
  return '$' + value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function initials(name) {
  const p = (name || '').trim().split(/\s+/);
  return ((p[0] || '')[0] || '') + ((p[1] || '')[0] || '');
}
