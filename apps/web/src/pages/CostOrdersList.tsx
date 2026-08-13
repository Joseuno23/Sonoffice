import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { TableSkeleton } from '../components/Skeletons';
import { Icon } from '../lib/icons';
import { fmtMoney } from '../lib/format';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const input: CSSProperties = { width: '100%', minHeight: 38, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const PER = 10;

// Mapea el color textual de sys_status a un color visual (fg + fondo suave).
const STATUS_COLORS: Record<string, [string, string]> = {
  success: ['#047857', 'rgba(16,185,129,.14)'],
  warning: ['#b45309', 'rgba(245,158,11,.16)'],
  info: ['#0369a1', 'rgba(56,189,248,.16)'],
  primary: ['#4338ca', 'rgba(99,102,241,.14)'],
  yellow: ['#a16207', 'rgba(234,179,8,.16)'],
  default: ['#475569', 'rgba(148,163,184,.16)'],
};

interface CostOrderItem {
  id: number;
  fecha: string | null;
  estado: string | null;
  estadoColor: string | null;
  idEstado: number | null;
  cliente: string | null;
  proveedor: string | null;
  campana: string | null;
  usuario: string | null;
  tipo: 'INTERNA' | 'EXTERNA' | null;
  total: number;
  permittedActions: string[];
}

interface StatusOption { id: number; label: string; }

// Catálogo de acciones (label + icono). El backend decide CUÁLES se muestran (permittedActions);
// aquí solo definimos cómo se ve cada una. El orden define el orden en el menú.
const ACTION_CATALOG: { code: string; label: string; icon: string; danger?: boolean }[] = [
  { code: 'edit', label: 'Editar', icon: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z' },
  { code: 'replace', label: 'Reemplazar', icon: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3' },
  { code: 'print', label: 'Imprimir', icon: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z' },
  { code: 'add-obs', label: 'Agregar observación', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { code: 'download', label: 'Descargar', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' },
  { code: 'anule', label: 'Anular', icon: 'M18 6L6 18M6 6l12 12', danger: true },
];

function formatDate(value: string | null) {
  return value ? new Date(value + 'T00:00:00').toLocaleDateString('es-CO') : 'Sin registro';
}

function StatusBadge({ estado, color }: { estado: string | null; color: string | null }) {
  if (!estado) return <span style={{ color: 'var(--muted,#64748b)', fontSize: 12.5 }}>—</span>;
  const [fg, bg] = STATUS_COLORS[color || 'default'] || STATUS_COLORS.default;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: fg, background: bg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {estado}
    </span>
  );
}

export default function CostOrdersList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CostOrderItem[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [estado, setEstado] = useState<number | 'all'>('all');
  const [page, setPage] = useState(1);
  const [moduleActions, setModuleActions] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ id: number; actions: string[]; x: number; y: number } | null>(null);

  // Debounce del buscador para no golpear el backend en cada tecla.
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  // Catálogo de estados (una sola vez).
  useEffect(() => {
    let live = true;
    api.getCostOrderStatuses()
      .then((res) => { if (live && res?.success) setStatuses(res.data || []); })
      .catch(() => { if (live) setStatuses([]); });
    return () => { live = false; };
  }, []);

  // Carga server-side cada vez que cambian filtros o página.
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api.getCostOrders({
      page,
      pageSize: PER,
      search: debouncedQ || undefined,
      estado: estado === 'all' ? undefined : estado,
    })
      .then((res) => {
        if (!live) return;
        if (res?.success) {
          setItems(res.data.items || []);
          setTotal(res.data.total || 0);
          setTotalPages(res.data.totalPages || 1);
          setModuleActions(res.data.moduleActions || []);
        } else {
          setItems([]);
          setError(res?.message || 'No se pudo cargar Órdenes de costo.');
        }
      })
      .catch(() => { if (live) { setItems([]); setError('No se pudo cargar Órdenes de costo.'); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [page, debouncedQ, estado]);

  const clearFilters = () => { setQ(''); setEstado('all'); setPage(1); };

  const chipStyle = (active: boolean): CSSProperties => active
    ? { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', border: '1px solid var(--primary,#0f172a)' }
    : { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', border: '1px solid var(--border,#e5e8ec)' };

  const navBtn = (disabled: boolean): CSSProperties => ({ height: 34, padding: '0 14px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', color: disabled ? 'var(--faint,#cbd5e1)' : 'var(--fg-2,#334155)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1 });

  const rangeStart = total ? (page - 1) * PER + 1 : 0;
  const rangeEnd = Math.min(page * PER, total);
  const hasRows = items.length > 0;

  return (
    <>
      <PageHeader
        crumb="Medios · Órdenes de costo"
        title="Órdenes de costo"
        sub="Consulta y da seguimiento a las órdenes de costo de medios."
        secondary={moduleActions.includes('duplicate') ? { label: 'Duplicar', onClick: () => {} } : undefined}
        primary={moduleActions.includes('create') ? { label: 'Nueva orden', onClick: () => navigate('/medios/ordenes-costo/nueva') } : undefined}
      />

      {error && (
        <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' }}>{error}</div>
      )}

      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por orden, proveedor, cliente, campaña o valor…"
            style={{ ...input, flex: 1, minWidth: 240, height: 38 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => { setEstado('all'); setPage(1); }} style={chipStyle(estado === 'all')}>Todos</button>
            {statuses.map((s) => (
              <button key={s.id} onClick={() => { setEstado(s.id); setPage(1); }} style={chipStyle(estado === s.id)}>{s.label}</button>
            ))}
          </div>
        </div>

        {loading ? <TableSkeleton /> : hasRows ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                    <th style={th}>Orden</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Proveedor</th>
                    <th style={th}>Campaña</th>
                    <th style={th}>Usuario</th>
                    <th style={th}>Estado</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    <th style={{ ...th, textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((order) => (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border,#e5e8ec)' }}>
                      <td style={{ padding: '13px 16px', color: 'var(--brand,#0891b2)', fontFamily: 'JetBrains Mono,monospace', fontWeight: 700 }}>#{order.id}<div style={{ color: 'var(--muted,#64748b)', fontFamily: 'inherit', fontSize: 11, marginTop: 3 }}>{formatDate(order.fecha)}</div></td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 220 }}>{order.cliente || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 220 }}>{order.proveedor || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 200 }}>{order.campana || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{order.usuario || '—'}</td>
                      <td style={{ padding: '13px 16px' }}><StatusBadge estado={order.estado} color={order.estadoColor} /></td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 600, color: 'var(--fg,#0f172a)', whiteSpace: 'nowrap' }}>{fmtMoney(order.total)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        {order.permittedActions.length > 0 ? (
                          <button
                            title="Acciones"
                            aria-label="Acciones"
                            onClick={(e) => { const rc = e.currentTarget.getBoundingClientRect(); setMenu({ id: order.id, actions: order.permittedActions, x: rc.right, y: rc.bottom }); }}
                            style={{ width: 32, height: 32, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', borderRadius: 8, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', transition: 'all .14s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)'; e.currentTarget.style.color = 'var(--fg,#0f172a)'; e.currentTarget.style.borderColor = 'var(--border-strong,#d5d9e0)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface,#fff)'; e.currentTarget.style.color = 'var(--muted,#64748b)'; e.currentTarget.style.borderColor = 'var(--border,#e5e8ec)'; }}
                          >
                            <Icon d="M12 6h.01M12 12h.01M12 18h.01" size={18} sw={2.5} />
                          </button>
                        ) : (
                          <span style={{ color: 'var(--faint,#cbd5e1)', fontSize: 12.5 }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '13px 18px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)' }}>
                Mostrando <b style={{ color: 'var(--fg,#0f172a)' }}>{rangeStart}–{rangeEnd}</b> de <b style={{ color: 'var(--fg,#0f172a)' }}>{total.toLocaleString('es-CO')}</b> órdenes
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={navBtn(page <= 1)}>
                  <Icon d="M15 6l-6 6 6 6" size={15} sw={2} />Anterior
                </button>
                <span style={{ fontSize: 12.5, color: 'var(--fg-2,#334155)', fontWeight: 600, fontFamily: 'JetBrains Mono,monospace' }}>
                  {page} / {totalPages.toLocaleString('es-CO')}
                </span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={navBtn(page >= totalPages)}>
                  Siguiente<Icon d="M9 6l6 6-6 6" size={15} sw={2} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: '70px 20px', textAlign: 'center', color: 'var(--muted,#64748b)' }}>
            {debouncedQ || estado !== 'all' ? 'No encontramos órdenes que coincidan con los filtros aplicados.' : 'Todavía no hay órdenes de costo.'}
            {(debouncedQ || estado !== 'all') ? <div style={{ marginTop: 16 }}><button onClick={clearFilters} style={{ height: 38, padding: '0 18px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Limpiar filtros</button></div> : null}
          </div>
        )}
      </div>

      {menu && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'fixed', top: menu.y + 6, left: menu.x - 190, width: 190, zIndex: 41, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 6 }}>
            {ACTION_CATALOG.filter((a) => menu.actions.includes(a.code)).map((a) => (
              <button
                key={a.code}
                onClick={() => {
                  const orderId = menu.id;
                  setMenu(null);
                  if (a.code === 'edit') navigate(`/medios/ordenes-costo/${orderId}/editar`);
                  /* otras acciones: pendientes de implementar */
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background .12s', color: a.danger ? '#ef4444' : 'var(--fg-2,#334155)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon d={a.icon} size={16} sw={1.8} />{a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
