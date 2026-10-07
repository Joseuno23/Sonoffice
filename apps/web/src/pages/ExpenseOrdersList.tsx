import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import { TableSkeleton } from '../components/Skeletons';
import ToastMessage from '../components/ToastMessage';
import { fmtMoneyFull } from '../lib/format';
import { Icon } from '../lib/icons';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const input: CSSProperties = { width: '100%', minHeight: 38, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const PER = 10;

interface ExpenseOrderItem { id: number; fecha: string | null; estado: string | null; estadoColor: string | null; proveedor: string | null; usuario: string | null; total: number; aprobada: boolean; recurrente: boolean; permittedActions: string[]; }

const ACTIONS = [
  { code: 'edit', label: 'Editar' },
  { code: 'view-canceled', label: 'Ver anulación' },
  { code: 'print', label: 'Imprimir' },
  { code: 'print-preview', label: 'Vista previa' },
  { code: 'approve', label: 'Aprobar' },
  { code: 'recurrence', label: 'Recurrencia' },
  { code: 'anule', label: 'Anular', danger: true },
];

function formatDate(value: string | null) { return value ? new Date(value + 'T00:00:00').toLocaleDateString('es-CO') : 'Sin registro'; }

function StatusBadge({ order }: { order: ExpenseOrderItem }) {
  const color = order.aprobada ? '#047857' : '#475569';
  const bg = order.aprobada ? 'rgba(16,185,129,.14)' : 'rgba(148,163,184,.16)';
  return <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '3px 10px', borderRadius: 7, color, background: bg, fontSize: 11.5, fontWeight: 800 }}>{order.aprobada ? 'Aprobada' : order.estado || '—'}{order.recurrente ? ' · Recurrente' : ''}</span>;
}

export default function ExpenseOrdersList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ExpenseOrderItem[]>([]);
  const [moduleActions, setModuleActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [fechaIni, setFechaIni] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: number; actions: string[]; x: number; y: number } | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; action: 'approve' | 'anule' } | null>(null);
  const [recurrence, setRecurrence] = useState<{ id: number; start: string; end: string; active: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { const timer = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350); return () => clearTimeout(timer); }, [q]);
  useEffect(() => { reload(); }, [page, debouncedQ, fechaIni, fechaFin]);

  const reload = () => {
    setLoading(true); setError(null);
    api.getExpenseOrders({ page, pageSize: PER, search: debouncedQ || undefined, fechaIni: fechaIni || undefined, fechaFin: fechaFin || undefined })
      .then((res) => { if (res?.success) { setItems(res.data.items || []); setModuleActions(res.data.moduleActions || []); setTotal(res.data.total || 0); setTotalPages(res.data.totalPages || 1); } else { setItems([]); setError(res?.message || 'No se pudo cargar Órdenes de gastos.'); } })
      .catch(() => { setItems([]); setError('No se pudo cargar Órdenes de gastos.'); })
      .finally(() => setLoading(false));
  };

  const runAction = () => {
    if (!confirm || saving) return;
    setSaving(true);
    const call = confirm.action === 'approve' ? api.approveExpenseOrder(confirm.id) : api.anuleExpenseOrder(confirm.id);
    call.then((res) => { if (res?.success) { setToast({ type: 'success', text: res.message || 'Acción ejecutada correctamente.' }); reload(); } else setToast({ type: 'error', text: res?.message || 'No se pudo ejecutar la acción.' }); })
      .catch(() => setToast({ type: 'error', text: 'No se pudo ejecutar la acción.' }))
      .finally(() => { setSaving(false); setConfirm(null); });
  };

  const saveRecurrence = () => {
    if (!recurrence || saving) return;
    setSaving(true);
    const call = recurrence.active ? api.clearExpenseOrderRecurrence(recurrence.id) : api.setExpenseOrderRecurrence(recurrence.id, { inicioRecurrencia: recurrence.start, finRecurrencia: recurrence.end });
    call.then((res) => { if (res?.success) { setToast({ type: 'success', text: res.message || 'Recurrencia actualizada.' }); setRecurrence(null); reload(); } else setToast({ type: 'error', text: res?.message || 'No se pudo actualizar la recurrencia.' }); })
      .catch(() => setToast({ type: 'error', text: 'No se pudo actualizar la recurrencia.' }))
      .finally(() => setSaving(false));
  };

  return <>
    <PageHeader crumb="Medios · Órdenes de gastos" title="Órdenes de gastos" sub="Consulta y administra las órdenes de gastos de medios." primary={moduleActions.includes('create') ? { label: 'Nueva orden', onClick: () => navigate('/medios/ordenes-gastos/nueva') } : undefined} />
    {error && <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, color: '#b91c1c', background: 'rgba(239,68,68,.10)', fontWeight: 700 }}>{error}</div>}
    <div style={card}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--border,#e5e8ec)', display: 'grid', gridTemplateColumns: 'minmax(240px,1fr) 160px 160px', gap: 12 }}>
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar por orden, proveedor, usuario, estado o valor…" style={input} />
        <input type="date" value={fechaIni} onChange={(event) => setFechaIni(event.target.value)} style={input} />
        <input type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} style={input} />
      </div>
      {loading ? <TableSkeleton /> : items.length ? <>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}><thead><tr style={{ background: 'var(--surface-2,#f7f8fa)' }}><th style={th}>Orden</th><th style={th}>Proveedor</th><th style={th}>Usuario</th><th style={th}>Estado</th><th style={{ ...th, textAlign: 'right' }}>Total</th><th style={th}></th></tr></thead><tbody>
          {items.map((order) => <tr key={order.id} style={{ borderBottom: '1px solid var(--border,#e5e8ec)' }}><td style={{ padding: '13px 16px' }}><button onClick={() => navigate(`/medios/ordenes-gastos/${order.id}/editar`)} style={{ padding: 0, border: 0, background: 'transparent', color: 'var(--brand,#0891b2)', fontWeight: 800, cursor: 'pointer' }}>#{order.id}</button><div style={{ fontSize: 11, color: 'var(--muted,#64748b)' }}>{formatDate(order.fecha)}</div></td><td style={{ padding: '13px 16px', fontSize: 13 }}>{order.proveedor || '—'}</td><td style={{ padding: '13px 16px', fontSize: 13 }}>{order.usuario || '—'}</td><td style={{ padding: '13px 16px' }}><StatusBadge order={order} /></td><td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 800 }}>{fmtMoneyFull(order.total)}</td><td style={{ padding: '13px 16px', textAlign: 'right' }}><button onClick={(event) => { const rc = event.currentTarget.getBoundingClientRect(); setMenu({ id: order.id, actions: order.permittedActions, x: rc.right, y: rc.bottom }); }} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border,#e5e8ec)', background: '#fff', cursor: 'pointer' }}><Icon d="M12 6h.01M12 12h.01M12 18h.01" size={18} sw={2.5} /></button></td></tr>)}
        </tbody></table></div>
        <div style={{ padding: 14, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{total.toLocaleString('es-CO')} órdenes</span><div style={{ display: 'flex', gap: 8 }}><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</button></div></div>
      </> : <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted,#64748b)' }}>No hay órdenes de gastos para mostrar.</div>}
    </div>
    {menu && <><div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} /><div style={{ position: 'fixed', zIndex: 41, top: menu.y + 6, left: menu.x - 190, width: 190, background: '#fff', border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, padding: 6, boxShadow: 'var(--shadow-lg)' }}>{ACTIONS.filter((a) => menu.actions.includes(a.code)).map((a) => <button key={a.code} onClick={() => { const id = menu.id; const order = items.find((item) => item.id === id); setMenu(null); if (a.code === 'edit' || a.code === 'view-canceled') navigate(`/medios/ordenes-gastos/${id}/editar`); if (a.code === 'print') window.open(`/medios/ordenes-gastos/${id}/imprimir?autoprint=1`, '_blank', 'noopener,noreferrer'); if (a.code === 'print-preview') window.open(`/medios/ordenes-gastos/${id}/imprimir`, '_blank', 'noopener,noreferrer'); if (a.code === 'approve') setConfirm({ id, action: 'approve' }); if (a.code === 'anule') setConfirm({ id, action: 'anule' }); if (a.code === 'recurrence') setRecurrence({ id, start: '', end: '', active: !!order?.recurrente }); }} style={{ width: '100%', padding: '9px 11px', border: 0, background: 'transparent', borderRadius: 8, textAlign: 'left', cursor: 'pointer', color: a.danger ? '#ef4444' : 'var(--fg-2,#334155)' }}>{a.label}</button>)}</div></>}
    {confirm && <ConfirmDialog open title={confirm.action === 'approve' ? `Aprobar orden #${confirm.id}` : `Anular orden #${confirm.id}`} description={confirm.action === 'approve' ? 'Esta acción marcará la orden como aprobada.' : 'Esta acción marcará la orden como anulada y tomará el consecutivo de anulación.'} confirmLabel={confirm.action === 'approve' ? 'Aprobar' : 'Anular'} tone={confirm.action === 'anule' ? 'danger' : 'warning'} loading={saving} onConfirm={runAction} onCancel={() => setConfirm(null)} />}
    {recurrence && <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center' }}><div style={{ width: 420, background: '#fff', borderRadius: 16, padding: 20 }}><h2 style={{ marginTop: 0 }}>Recurrencia</h2>{recurrence.active ? <p>Esta acción quitará la recurrencia de la orden.</p> : <div style={{ display: 'grid', gap: 12 }}><input type="date" value={recurrence.start} onChange={(e) => setRecurrence((r) => r ? { ...r, start: e.target.value } : r)} style={input} /><input type="date" value={recurrence.end} onChange={(e) => setRecurrence((r) => r ? { ...r, end: e.target.value } : r)} style={input} /></div>}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}><button onClick={() => setRecurrence(null)}>Cancelar</button><button onClick={saveRecurrence} disabled={saving || (!recurrence.active && (!recurrence.start || !recurrence.end))}>{saving ? 'Guardando…' : recurrence.active ? 'Quitar' : 'Guardar'}</button></div></div></div>}
    <ToastMessage type={toast?.type} message={toast?.text} onDismiss={() => setToast(null)} />
  </>;
}
