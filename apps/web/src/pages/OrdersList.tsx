import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useTheme } from '../theme/ThemeContext';
import { badgeStyle, barColor } from '../lib/status';
import { fmtMoney, initials } from '../lib/format';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { TableSkeleton } from '../components/Skeletons';
import { api } from '../services/api';

const card = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const CHIPS = ['Todos', 'Activo', 'En proceso', 'Pendiente', 'Cerrado', 'Anulado'];
const COLS = [['id', 'ID', 'left', 1], ['cliente', 'Cliente', 'left', 1], ['ref', 'Referencia', 'left', 1], ['resp', 'Responsable', 'left', 0], ['estado', 'Estado', 'left', 1], ['avance', 'Avance', 'left', 1], ['valor', 'Valor', 'right', 1], ['', '', 'right', 0]] as const;
const ORDER = { Activo: 0, 'En proceso': 1, Pendiente: 2, Cerrado: 3, Anulado: 4 };
const PER = 8;

export default function OrdersList() {
  const navigate = useNavigate();
  const { dark: d } = useTheme();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('Todos');
  const [sortKey, setSortKey] = useState('fecha');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState(null); // {id, x, y}

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getOrders()
      .then((rows) => { if (live) setAll(rows); })
      .catch(() => { if (live) setAll([]); })
      .finally(() => { if (live) setTimeout(() => setLoading(false), 500); });
    return () => { live = false; };
  }, []);

  // filter + sort
  let rows = all.slice();
  if (q.trim()) {
    const ql = q.toLowerCase();
    rows = rows.filter((o) => o.id.toLowerCase().includes(ql) || o.cliente.toLowerCase().includes(ql) || o.ref.toLowerCase().includes(ql));
  }
  if (estado !== 'Todos') rows = rows.filter((o) => o.estado === estado);
  rows.sort((a, b) => {
    let x, y;
    if (sortKey === 'fecha') { x = new Date(a.fecha).getTime(); y = new Date(b.fecha).getTime(); }
    else if (sortKey === 'valor') { x = a.valor; y = b.valor; }
    else if (sortKey === 'estado') { x = ORDER[a.estado]; y = ORDER[b.estado]; }
    else if (sortKey === 'avance') { x = a.avance; y = b.avance; }
    else { x = (a[sortKey] || '').toString().toLowerCase(); y = (b[sortKey] || '').toString().toLowerCase(); }
    if (x < y) return sortDir === 'asc' ? -1 : 1;
    if (x > y) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PER));
  const curPage = Math.min(page, totalPages);
  const pageRows = rows.slice((curPage - 1) * PER, curPage * PER);

  const setSort = (k) => {
    if (sortKey === k) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };
  const clearFilters = () => { setQ(''); setEstado('Todos'); setPage(1); };

  const chipStyle = (active) => active
    ? { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', border: '1px solid var(--primary,#0f172a)' }
    : { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', border: '1px solid var(--border,#e5e8ec)' };

  const menuItemStyle = (color): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background .12s', color });

  const anular = () => {
    setAll((list) => list.map((o) => (o.id === menu.id ? { ...o, estado: 'Anulado', avance: 0 } : o)));
    setMenu(null);
  };

  return (
    <>
      <PageHeader
        crumb="Operación · Órdenes"
        title="Órdenes de Producción"
        sub="Gestiona y da seguimiento a todas las órdenes."
        secondary={{ label: 'Exportar', onClick: () => {} }}
        primary={{ label: 'Nueva orden', onClick: () => navigate('/ordenes/nueva') }}
      />

      <div style={card}>
        {/* filters */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}>
              <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5" size={15} sw={2} />
            </span>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar por ID, cliente o referencia…" style={{ width: '100%', height: 38, padding: '0 12px 0 36px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none', transition: 'all .15s' }} onFocus={(e) => { e.target.style.borderColor = 'var(--brand,#0891b2)'; e.target.style.boxShadow = '0 0 0 3px var(--brand-soft,#ecfeff)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--border,#e5e8ec)'; e.target.style.boxShadow = 'none'; }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHIPS.map((c) => (
              <button key={c} onClick={() => { setEstado(c); setPage(1); }} style={chipStyle(estado === c)}>{c}</button>
            ))}
          </div>
          <button style={{ height: 38, padding: '0 13px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all .14s' }}>
            <Icon d="M4 5h16l-6 8v6l-4-2v-4z" size={15} sw={1.9} />
            Filtros
          </button>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : total > 0 ? (
          <>
            <div style={{ overflowX: 'auto', animation: 'scfade .3s ease' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                    {COLS.map((col, i) => {
                      const sortable = !!col[3] && col[0];
                      const on = sortKey === col[0];
                      return (
                        <th key={i} onClick={sortable ? () => setSort(col[0]) : undefined} style={{ textAlign: col[2], padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border,#e5e8ec)', cursor: sortable ? 'pointer' : 'default', userSelect: 'none' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, verticalAlign: 'middle' }}>
                            {col[1]}
                            {on && <span style={{ fontSize: 8, color: 'var(--brand,#0891b2)' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((o) => (
                    <tr key={o.id} onClick={() => navigate('/ordenes/' + o.id)} style={{ cursor: 'pointer', transition: 'background .12s', borderBottom: '1px solid var(--border,#e5e8ec)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5, fontWeight: 600, color: 'var(--brand,#0891b2)', whiteSpace: 'nowrap' }}>{o.id}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--fg,#0f172a)', whiteSpace: 'nowrap' }}>{o.cliente}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 230, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.ref}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 24, height: 24, borderRadius: 7, background: 'var(--surface-3,#f1f3f6)', color: 'var(--fg-2,#334155)', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', flex: 'none' }}>{initials(o.resp)}</span>
                          <span style={{ fontSize: 13, color: 'var(--fg-2,#334155)', whiteSpace: 'nowrap' }}>{o.resp}</span>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={badgeStyle(o.estado, d)}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{o.estado}</span>
                      </td>
                      <td style={{ padding: '13px 16px', minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface-3,#eef1f4)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: o.avance + '%', background: barColor(o.estado) }} />
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-2,#334155)', fontFamily: 'JetBrains Mono,monospace', width: 34, textAlign: 'right' }}>{o.avance}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 600, color: 'var(--fg,#0f172a)', whiteSpace: 'nowrap' }}>{fmtMoney(o.valor)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        <button onClick={(e) => { e.stopPropagation(); const rc = e.currentTarget.getBoundingClientRect(); setMenu({ id: o.id, x: rc.right, y: rc.bottom }); }} title="Acciones" aria-label="Acciones" style={{ width: 32, height: 32, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', borderRadius: 8, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', transition: 'all .14s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)'; e.currentTarget.style.color = 'var(--fg,#0f172a)'; e.currentTarget.style.borderColor = 'var(--border-strong,#d5d9e0)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface,#fff)'; e.currentTarget.style.color = 'var(--muted,#64748b)'; e.currentTarget.style.borderColor = 'var(--border,#e5e8ec)'; }}>
                          <Icon d="M12 6h.01M12 12h.01M12 18h.01" size={18} sw={2.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {menu && (
              <>
                <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'fixed', top: menu.y + 6, right: window.innerWidth - menu.x, zIndex: 41, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, boxShadow: 'var(--shadow-lg,0 16px 40px -14px rgba(15,23,42,.2))', padding: 6, minWidth: 174, animation: 'scpop .16s ease' }}>
                  <button onClick={() => setMenu(null)} style={menuItemStyle('var(--fg-2,#334155)')} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <Icon d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" size={16} sw={1.8} />Imprimir
                  </button>
                  <button onClick={() => { const id = menu.id; setMenu(null); navigate('/ordenes/' + id); }} style={menuItemStyle('var(--fg-2,#334155)')} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <Icon d={['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z']} size={16} sw={1.8} />Ver
                  </button>
                  <button onClick={anular} style={menuItemStyle('#ef4444')} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <Icon d={['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M5 5l14 14']} size={16} sw={1.8} stroke="#ef4444" />Anular
                  </button>
                </div>
              </>
            )}

            <Pagination page={curPage} totalPages={totalPages} total={total} start={total ? (curPage - 1) * PER + 1 : 0} end={Math.min(curPage * PER, total)} onPage={setPage} />
          </>
        ) : (
          <div style={{ padding: '70px 20px', textAlign: 'center', animation: 'scfade .3s ease' }}>
            <div style={{ width: 66, height: 66, borderRadius: 18, background: 'var(--surface-3,#f1f3f6)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', color: 'var(--faint,#94a3b8)' }}>
              <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5" size={30} sw={1.6} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 6 }}>Sin resultados</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted,#64748b)', maxWidth: 320, margin: '0 auto 20px' }}>No encontramos órdenes que coincidan con los filtros aplicados. Prueba ajustar tu búsqueda.</div>
            <button onClick={clearFilters} style={{ height: 38, padding: '0 18px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Limpiar filtros</button>
          </div>
        )}
      </div>
    </>
  );
}
