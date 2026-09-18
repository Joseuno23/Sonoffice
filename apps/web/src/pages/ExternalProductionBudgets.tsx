import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
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
const label: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--fg-2,#334155)', marginBottom: 6 };
const PER = 10;

const STATUS_COLORS: Record<string, [string, string]> = {
  activo: ['#047857', 'rgba(16,185,129,.14)'],
  activa: ['#047857', 'rgba(16,185,129,.14)'],
  anulado: ['#b91c1c', 'rgba(239,68,68,.12)'],
  anulada: ['#b91c1c', 'rgba(239,68,68,.12)'],
  impreso: ['#0369a1', 'rgba(56,189,248,.16)'],
  impresa: ['#0369a1', 'rgba(56,189,248,.16)'],
  default: ['#475569', 'rgba(148,163,184,.16)'],
};

interface BudgetRow {
  id: number;
  fecha: string | null;
  cliente: string | null;
  proveedor: string | null;
  ordenCliente?: string | null;
  campana?: string | null;
  usuario?: string | null;
  estado: string | null;
  idEstado?: number | null;
  numImpresiones?: number | null;
  orderNumber?: string | null;
  actions?: BudgetActionCode[];
  total: number | string | null;
}

interface StatusOption { id: number; label: string; }

const normalizeStatus = (value: string | null) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const hiddenFilterStatuses = new Set(['anulado facturado', 'enviada a cen']);

type BudgetActionCode = 'print' | 'print-order' | 'support' | 'view-anule' | 'edit' | 'duplicate' | 'replace' | 'add-order' | 'anule';

const ACTION_CATALOG: { code: BudgetActionCode; label: string; icon: string; danger?: boolean }[] = [
  { code: 'print', label: 'Imprimir', icon: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z' },
  { code: 'print-order', label: 'Imprimir Orden', icon: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z' },
  { code: 'edit', label: 'Editar', icon: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z' },
  { code: 'view-anule', label: 'Ver Anulación', icon: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7zM12 9v4l3 2' },
  { code: 'support', label: 'Soporte de Pauta', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5' },
  { code: 'duplicate', label: 'Duplicar', icon: 'M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3M8 7V5a2 2 0 0 1 2-2h7l4 4v8a2 2 0 0 1-2 2h-3' },
  { code: 'replace', label: 'Reemplazar', icon: 'M8 7h8M16 7l-3-3M16 7l-3 3M16 17H8M8 17l3 3M8 17l3-3' },
  { code: 'add-order', label: 'Add Orden', icon: 'M12 5v14M5 12h14' },
  { code: 'anule', label: 'Anular', icon: 'M18 6L6 18M6 6l12 12', danger: true },
];

function formatDate(value: string | null) {
  return value ? new Date(value + 'T00:00:00').toLocaleDateString('es-CO') : 'Sin registro';
}

function StatusBadge({ estado }: { estado: string | null }) {
  if (!estado) return <span style={{ color: 'var(--muted,#64748b)', fontSize: 12.5 }}>—</span>;
  const [fg, bg] = STATUS_COLORS[estado.toLowerCase()] || STATUS_COLORS.default;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: fg, background: bg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {estado}
    </span>
  );
}

export default function ExternalProductionBudgets() {
  const navigate = useNavigate();
  const [items, setItems] = useState<BudgetRow[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [estado, setEstado] = useState<number | 'all'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ action: 'anule' | 'duplicate' | 'replace'; id: number } | null>(null);
  const [addOrderTarget, setAddOrderTarget] = useState<BudgetRow | null>(null);
  const [addOrderValue, setAddOrderValue] = useState('');
  const [addingOrder, setAddingOrder] = useState(false);
  const [menu, setMenu] = useState<{ row: BudgetRow; x: number; y: number } | null>(null);
  const [anuleReason, setAnuleReason] = useState('');
  const addOrderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQ(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let live = true;
    api.getExternalProductionBudgetStatuses()
      .then((res) => { if (live && res?.success) setStatuses((res.data || []).filter((row: StatusOption) => !hiddenFilterStatuses.has(normalizeStatus(row.label)))); })
      .catch(() => { if (live) setStatuses([]); });
    return () => { live = false; };
  }, []);

  const reload = () => {
    setLoading(true);
    setMessage(null);
    api.getExternalProductionBudgets({ page, pageSize: PER, search: debouncedQ || undefined, estado: estado === 'all' ? undefined : estado })
      .then((res) => {
        if (res?.success) {
          setItems(res.data.items || []);
          setTotal(res.data.total || 0);
          setTotalPages(res.data.totalPages || 1);
        } else {
          setItems([]);
          setTotal(0);
          setMessage({ type: 'error', text: res?.message || 'No se pudo cargar presupuestos.' });
        }
      })
      .catch(() => { setItems([]); setTotal(0); setMessage({ type: 'error', text: 'No se pudo cargar presupuestos.' }); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [page, debouncedQ, estado]);

  useEffect(() => {
    if (!addOrderTarget) return undefined;
    const timer = window.setTimeout(() => {
      addOrderInputRef.current?.focus();
      addOrderInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [addOrderTarget]);

  const runAction = () => {
    if (!confirm) return;
    const reason = anuleReason.trim();
    const call = confirm.action === 'anule' ? api.anuleExternalProductionBudget(confirm.id, reason) : confirm.action === 'replace' ? api.replaceExternalProductionBudget(confirm.id) : api.duplicateExternalProductionBudget(confirm.id);
    call.then((res) => {
      if (res?.success) {
        if ((confirm.action === 'duplicate' || confirm.action === 'replace') && res.data?.id) {
          navigate(`/medios/presupuestos/produccion-externa/${res.data.id}/editar`, { state: { message: res.message } });
          return;
        }
        setMessage({ type: 'success', text: res.message });
        if (confirm.action === 'anule') setToast({ type: 'success', text: res.message || 'Presupuesto anulado correctamente.' });
        reload();
      } else setMessage({ type: 'error', text: res?.message || 'No se pudo ejecutar la acción.' });
    })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo ejecutar la acción.' }))
      .finally(() => { setConfirm(null); setAnuleReason(''); });
  };

  const clearFilters = () => { setQ(''); setEstado('all'); setPage(1); };

  const legacyFallbackActions = (row: BudgetRow): BudgetActionCode[] => ['print', ...(Number(row.idEstado) !== 9999 ? ['print-order', 'support'] as BudgetActionCode[] : []), 'edit', 'duplicate', ...(((Number(row.idEstado) === 1 && Number(row.numImpresiones ?? -1) === -1) || Number(row.idEstado) === 5) ? ['anule'] as BudgetActionCode[] : [])];
  const actionsFor = (row: BudgetRow) => {
    const codes = new Set(row.actions?.length ? row.actions : legacyFallbackActions(row));
    return ACTION_CATALOG.filter((action) => codes.has(action.code));
  };

  const handleAddOrder = (row: BudgetRow) => {
    setAddOrderTarget(row);
    setAddOrderValue(row.orderNumber || row.ordenCliente || '');
  };

  const closeAddOrder = () => {
    if (addingOrder) return;
    setAddOrderTarget(null);
    setAddOrderValue('');
  };

  const saveAddOrder = () => {
    if (!addOrderTarget) return;
    setAddingOrder(true);
    api.addExternalProductionBudgetOrder(addOrderTarget.id, addOrderValue.trim())
      .then((res) => {
        if (res?.success) { setMessage({ type: 'success', text: res.message || 'Orden agregada correctamente.' }); reload(); }
        else setMessage({ type: 'error', text: res?.message || 'No se pudo agregar la orden.' });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo agregar la orden.' }))
      .finally(() => { setAddingOrder(false); setAddOrderTarget(null); setAddOrderValue(''); });
  };

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
        crumb="Medios · Presupuestos"
        title="Presupuesto Producción Externa"
        sub="Consulta y da seguimiento a los presupuestos de producción externa."
        primary={{ label: 'Nuevo presupuesto', onClick: () => navigate('/medios/presupuestos/produccion-externa/nuevo') }}
      />

      {message && <AlertMessage type={message.type} style={{ marginBottom: 14 }}>{message.text}</AlertMessage>}

      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por presupuesto, cliente, proveedor o campaña…"
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
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                    <th style={th}>Presupuesto</th>
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
                  {items.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border,#e5e8ec)' }}>
                      <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono,monospace', fontWeight: 700 }}>
                        <button onClick={() => navigate(`/medios/presupuestos/produccion-externa/${row.id}/editar`)} style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--brand,#0891b2)', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>#{row.id}</button>
                        <div style={{ color: 'var(--muted,#64748b)', fontFamily: 'inherit', fontSize: 11, marginTop: 3 }}>{formatDate(row.fecha)}</div>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 220 }}>{row.cliente || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 220 }}>{row.proveedor || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 200 }}>{row.campana || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{row.usuario || '—'}</td>
                      <td style={{ padding: '13px 16px' }}><StatusBadge estado={row.estado} /></td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 600, color: 'var(--fg,#0f172a)', whiteSpace: 'nowrap' }}>{fmtMoneyFull(Number(row.total || 0))}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        <button
                          title="Acciones"
                          aria-label="Acciones"
                          onClick={(event) => { const rc = event.currentTarget.getBoundingClientRect(); setMenu({ row, x: rc.right, y: rc.bottom }); }}
                          style={{ width: 32, height: 32, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', borderRadius: 8, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', transition: 'all .14s' }}
                          onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)'; event.currentTarget.style.color = 'var(--fg,#0f172a)'; event.currentTarget.style.borderColor = 'var(--border-strong,#d5d9e0)'; }}
                          onMouseLeave={(event) => { event.currentTarget.style.background = 'var(--surface,#fff)'; event.currentTarget.style.color = 'var(--muted,#64748b)'; event.currentTarget.style.borderColor = 'var(--border,#e5e8ec)'; }}
                        >
                          <Icon d="M12 6h.01M12 12h.01M12 18h.01" size={18} sw={2.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '13px 18px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)' }}>
                Mostrando <b style={{ color: 'var(--fg,#0f172a)' }}>{rangeStart}–{rangeEnd}</b> de <b style={{ color: 'var(--fg,#0f172a)' }}>{total.toLocaleString('es-CO')}</b> presupuestos
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
            {debouncedQ || estado !== 'all' ? 'No encontramos presupuestos que coincidan con los filtros aplicados.' : 'Todavía no hay presupuestos de producción externa.'}
            {(debouncedQ || estado !== 'all') ? <div style={{ marginTop: 16 }}><button onClick={clearFilters} style={{ height: 38, padding: '0 18px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Limpiar filtros</button></div> : null}
          </div>
        )}
      </div>

      {menu && (
        <>
          <div onClick={() => setMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'fixed', top: menu.y + 6, left: menu.x - 190, width: 190, zIndex: 41, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 6 }}>
            {actionsFor(menu.row).map((action) => (
              <button
                key={action.code}
                onClick={() => {
                  const budgetId = menu.row.id;
                  setMenu(null);
                  if (action.code === 'edit') navigate(`/medios/presupuestos/produccion-externa/${budgetId}/editar`);
                  if (action.code === 'view-anule') navigate(`/medios/presupuestos/produccion-externa/${budgetId}/editar`);
                  if (action.code === 'print') window.open(`/medios/presupuestos/produccion-externa/${budgetId}/imprimir?autoprint=1`, '_blank', 'noopener,noreferrer');
                  if (action.code === 'print-order') window.open(`/medios/presupuestos/produccion-externa/${budgetId}/imprimir?orden=1&autoprint=1`, '_blank', 'noopener,noreferrer');
                  if (action.code === 'support') navigate(`/medios/presupuestos/produccion-externa/${budgetId}/soporte-pauta`);
                  if (action.code === 'add-order') handleAddOrder(menu.row);
                  if (action.code === 'anule' || action.code === 'duplicate' || action.code === 'replace') setConfirm({ action: action.code, id: budgetId });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background .12s', color: action.danger ? '#ef4444' : 'var(--fg-2,#334155)' }}
                onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')}
                onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}
              >
                <Icon d={action.icon} size={16} sw={1.8} />{action.label}
              </button>
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title="Confirmar acción"
        description={confirm?.action === 'anule' ? <div><div>Esta acción anula el presupuesto y reversa asociaciones de órdenes de costo si existen.</div><label style={{ ...label, marginTop: 10 }}>Motivo de anulación <span style={{ color: 'var(--muted,#64748b)', fontWeight: 600 }}>(obligatorio si tiene órdenes de costo)</span></label><textarea value={anuleReason} onChange={(event) => setAnuleReason(event.target.value)} rows={3} style={{ ...input, height: 'auto', paddingTop: 10, fontFamily: 'inherit' }} /></div> : confirm?.action === 'replace' ? 'Se creará un presupuesto activo de reemplazo, siguiendo el flujo legacy para presupuestos en Nota Crédito.' : 'Esta acción aplica el comportamiento legacy para Producción Externa.'}
        confirmLabel="Confirmar"
        tone={confirm?.action === 'anule' ? 'danger' : 'warning'}
        onConfirm={runAction}
        onCancel={() => { setConfirm(null); setAnuleReason(''); }}
      />

      <ConfirmDialog
        open={!!addOrderTarget}
        title="Agregar orden de servicio"
        description={
          <div>
            <div>Ingresá el número o valor de orden asociado al presupuesto #{addOrderTarget?.id}.</div>
            <label style={{ ...label, marginTop: 10 }} htmlFor="external-production-add-order">Orden de servicio</label>
            <input
              ref={addOrderInputRef}
              id="external-production-add-order"
              value={addOrderValue}
              onChange={(event) => setAddOrderValue(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') saveAddOrder(); }}
              style={input}
            />
          </div>
        }
        confirmLabel="Guardar orden"
        tone="warning"
        loading={addingOrder}
        onConfirm={saveAddOrder}
        onCancel={closeAddOrder}
      />

      <ToastMessage type={toast?.type} message={toast?.text} onDismiss={() => setToast(null)} />
    </>
  );
}
