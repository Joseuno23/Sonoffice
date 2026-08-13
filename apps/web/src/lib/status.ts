// Status color palettes: [fg-light, bg-light, fg-dark, bg-dark, bar-color]
export const STATUS = {
  Activo: ['#047857', '#d1fae5', '#6ee7b7', 'rgba(16,185,129,.16)', '#10b981'],
  'En proceso': ['#0369a1', '#e0f2fe', '#7dd3fc', 'rgba(56,189,248,.16)', '#38bdf8'],
  Pendiente: ['#b45309', '#fef3c7', '#fcd34d', 'rgba(245,158,11,.18)', '#f59e0b'],
  Cerrado: ['#475569', '#e2e8f0', '#cbd5e1', 'rgba(148,163,184,.18)', '#94a3b8'],
  Anulado: ['#b91c1c', '#fee2e2', '#fca5a5', 'rgba(244,63,94,.16)', '#f43f5e'],
};

export function badgeStyle(est, dark) {
  const m = STATUS[est] || STATUS.Cerrado;
  const fg = dark ? m[2] : m[0];
  const bg = dark ? m[3] : m[1];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '11.5px',
    fontWeight: 600,
    background: bg,
    color: fg,
    whiteSpace: 'nowrap',
  };
}

export function barColor(est) {
  const m = STATUS[est] || STATUS.Cerrado;
  return m[4];
}
