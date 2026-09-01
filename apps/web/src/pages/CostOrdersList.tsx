import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import { TableSkeleton } from '../components/Skeletons';
import { Icon } from '../lib/icons';
import { fmtMoneyFull } from '../lib/format';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const input: CSSProperties = { width: '100%', minHeight: 38, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const PER = 10;
const FINAL_OBSERVATION_MAX_LENGTH = 3000;

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
  hasFinalObservation: boolean;
  hasBudgetLinks: boolean;
  permittedActions: string[];
}

interface StatusOption { id: number; label: string; }

interface CostOrderDuplicateCandidate {
  id: number;
  fecha: string | null;
  cliente: string | null;
  proveedor: string | null;
  campana: string | null;
  total: number;
}

// Catálogo de acciones (label + icono). El backend decide CUÁLES se muestran (permittedActions);
// aquí solo definimos cómo se ve cada una. El orden define el orden en el menú.
const ACTION_CATALOG: { code: string; label: string; icon: string; danger?: boolean }[] = [
  { code: 'edit', label: 'Editar', icon: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z' },
  { code: 'finish', label: 'Finalizar', icon: 'M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10' },
  { code: 'replace', label: 'Reemplazar', icon: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3' },
  { code: 'print', label: 'Imprimir', icon: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z' },
  { code: 'add-obs', label: 'Agregar observación', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
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
  const [finishing, setFinishing] = useState<number | null>(null);
  const [savingAction, setSavingAction] = useState<{ orderId: number; action: 'anule' | 'replace' } | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateSearch, setDuplicateSearch] = useState('');
  const [duplicateCandidates, setDuplicateCandidates] = useState<CostOrderDuplicateCandidate[]>([]);
  const [duplicateSelected, setDuplicateSelected] = useState<Set<number>>(new Set());
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [finalObs, setFinalObs] = useState<{ orderId: number; mode: 'add' | 'view'; value: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ orderId: number; action: 'finish' | 'anule' | 'replace' } | null>(null);
  const [finalObsLoading, setFinalObsLoading] = useState(false);
  const [finalObsSaving, setFinalObsSaving] = useState(false);
  const [finalObsError, setFinalObsError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const finalObsRequestId = useRef(0);

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

  useEffect(() => {
    if (!duplicateOpen) return;
    let live = true;
    const timer = setTimeout(() => {
      setDuplicateLoading(true);
      setDuplicateError(null);
      api.getCostOrderDuplicateCandidates(duplicateSearch.trim())
        .then((res) => {
          if (!live) return;
          if (res?.success) setDuplicateCandidates(res.data || []);
          else {
            setDuplicateCandidates([]);
            setDuplicateError(res?.message || 'No se pudieron cargar órdenes para duplicar.');
          }
        })
        .catch(() => { if (live) { setDuplicateCandidates([]); setDuplicateError('No se pudieron cargar órdenes para duplicar.'); } })
        .finally(() => { if (live) setDuplicateLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [duplicateOpen, duplicateSearch]);

  const clearFilters = () => { setQ(''); setEstado('all'); setPage(1); };

  const openDuplicate = () => {
    setDuplicateOpen(true);
    setDuplicateSearch('');
    setDuplicateSelected(new Set());
    setDuplicateError(null);
  };

  const closeDuplicate = () => {
    if (duplicateSaving) return;
    setDuplicateOpen(false);
    setDuplicateCandidates([]);
    setDuplicateSelected(new Set());
    setDuplicateError(null);
  };

  const toggleDuplicateSelection = (id: number) => {
    setDuplicateSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const duplicateOrders = () => {
    if (duplicateSaving || duplicateSelected.size === 0) return;
    setDuplicateSaving(true);
    setDuplicateError(null);
    api.duplicateCostOrders(Array.from(duplicateSelected).sort((a, b) => a - b))
      .then((res) => {
        if (res?.success) {
          setDuplicateOpen(false);
          setDuplicateCandidates([]);
          setDuplicateSelected(new Set());
          setDuplicateError(null);
          reload();
        } else {
          setDuplicateError(res?.message || 'No se pudieron duplicar las órdenes.');
        }
      })
      .catch(() => setDuplicateError('No se pudieron duplicar las órdenes.'))
      .finally(() => setDuplicateSaving(false));
  };

  const reload = () => {
    setLoading(true);
    setError(null);
    api.getCostOrders({ page, pageSize: PER, search: debouncedQ || undefined, estado: estado === 'all' ? undefined : estado })
      .then((res) => {
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
      .catch(() => { setItems([]); setError('No se pudo cargar Órdenes de costo.'); })
      .finally(() => setLoading(false));
  };

  const finalizeOrder = (orderId: number) => {
    if (finishing !== null) return;
    setFinishing(orderId);
    setError(null);
    api.finalizeCostOrder(orderId)
      .then((res) => {
        if (res?.success) reload();
        else setError(res?.message || 'No se pudo finalizar la orden.');
      })
      .catch(() => setError('No se pudo finalizar la orden.'))
      .finally(() => { setFinishing(null); setConfirmAction(null); });
  };

  const anuleOrder = (orderId: number) => {
    if (savingAction) return;
    setSavingAction({ orderId, action: 'anule' });
    setError(null);
    setSuccess(null);
    api.anuleCostOrder(orderId)
      .then((res) => {
        if (res?.success) {
          setSuccess(res.message || 'Orden anulada correctamente.');
          reload();
        } else {
          setError(res?.message || 'No se pudo anular la orden.');
        }
      })
      .catch(() => setError('No se pudo anular la orden.'))
      .finally(() => { setSavingAction(null); setConfirmAction(null); });
  };

  const replaceOrder = (orderId: number) => {
    if (savingAction) return;
    setSavingAction({ orderId, action: 'replace' });
    setError(null);
    setSuccess(null);
    api.replaceCostOrder(orderId)
      .then((res) => {
        if (res?.success) {
          const newOrderId = res.data?.id;
          setSuccess(newOrderId ? `Orden reemplazada correctamente. Nueva orden: ${newOrderId}.` : (res.message || 'Orden reemplazada correctamente.'));
          reload();
        } else {
          setError(res?.message || 'No se pudo reemplazar la orden.');
        }
      })
      .catch(() => setError('No se pudo reemplazar la orden.'))
      .finally(() => { setSavingAction(null); setConfirmAction(null); });
  };

  const confirmDetails = confirmAction ? {
    finish: {
      title: 'Finalizar orden de costo',
      description: 'Al finalizar no podrás modificar ni agregar más items a la orden.',
      confirmLabel: 'Finalizar orden',
      tone: 'warning' as const,
      loading: finishing === confirmAction.orderId,
      onConfirm: () => finalizeOrder(confirmAction.orderId),
    },
    anule: {
      title: `Anular orden #${confirmAction.orderId}`,
      description: 'Esta acción marcará la orden como anulada. Confirmá solo si estás seguro.',
      confirmLabel: 'Anular orden',
      tone: 'danger' as const,
      loading: savingAction?.orderId === confirmAction.orderId && savingAction.action === 'anule',
      onConfirm: () => anuleOrder(confirmAction.orderId),
    },
    replace: {
      title: `Reemplazar orden #${confirmAction.orderId}`,
      description: 'Se creará una nueva orden basada en esta y se mantendrá el flujo actual de reemplazo.',
      confirmLabel: 'Reemplazar orden',
      tone: 'warning' as const,
      loading: savingAction?.orderId === confirmAction.orderId && savingAction.action === 'replace',
      onConfirm: () => replaceOrder(confirmAction.orderId),
    },
  }[confirmAction.action] : null;

  const openFinalObservation = (orderId: number) => {
    const requestId = finalObsRequestId.current + 1;
    finalObsRequestId.current = requestId;
    setFinalObs({ orderId, mode: 'add', value: '' });
    setFinalObsLoading(true);
    setFinalObsError(null);
    setSuccess(null);
    api.getCostOrderFinalObservation(orderId)
      .then((res) => {
        if (finalObsRequestId.current !== requestId) return;
        if (res?.success) {
          const value = res.data?.obsFinal || '';
          setFinalObs({ orderId, mode: value.trim() ? 'view' : 'add', value });
        } else {
          setFinalObsError(res?.message || 'No se pudo cargar la observación final.');
        }
      })
      .catch(() => { if (finalObsRequestId.current === requestId) setFinalObsError('No se pudo cargar la observación final.'); })
      .finally(() => { if (finalObsRequestId.current === requestId) setFinalObsLoading(false); });
  };

  const closeFinalObservation = () => {
    if (finalObsSaving) return;
    finalObsRequestId.current += 1;
    setFinalObs(null);
    setFinalObsError(null);
  };

  const saveFinalObservation = () => {
    if (!finalObs || finalObs.mode === 'view' || finalObsSaving) return;
    const value = finalObs.value.trim();
    if (!value) {
      setFinalObsError('La observación final es obligatoria.');
      return;
    }
    if (value.length > FINAL_OBSERVATION_MAX_LENGTH) {
      setFinalObsError(`La observación final no puede superar ${FINAL_OBSERVATION_MAX_LENGTH} caracteres.`);
      return;
    }

    setFinalObsSaving(true);
    setFinalObsError(null);
    api.addCostOrderFinalObservation(finalObs.orderId, value)
      .then((res) => {
        if (res?.success) {
          setFinalObs(null);
          setSuccess(res.message || 'Observación final guardada correctamente.');
          reload();
        } else {
          setFinalObsError(res?.message || 'No se pudo guardar la observación final.');
        }
      })
      .catch(() => setFinalObsError('No se pudo guardar la observación final.'))
      .finally(() => setFinalObsSaving(false));
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
        crumb="Medios · Órdenes de costo"
        title="Órdenes de costo"
        sub="Consulta y da seguimiento a las órdenes de costo de medios."
        secondary={moduleActions.includes('duplicate') ? { label: 'Duplicar', onClick: openDuplicate } : undefined}
        primary={moduleActions.includes('create') ? { label: 'Nueva orden', onClick: () => navigate('/medios/ordenes-costo/nueva') } : undefined}
      />

      {error && (
        <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' }}>{error}</div>
      )}
      {success && (
        <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#047857', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.20)' }}>{success}</div>
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
                  {items.map((order) => {
                    const canEdit = order.permittedActions.includes('edit');
                    const visibleActions = order.permittedActions.filter((action) => ACTION_CATALOG.some((catalogAction) => catalogAction.code === action));
                    return (
                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border,#e5e8ec)' }}>
                      <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono,monospace', fontWeight: 700 }}>
                        {canEdit ? (
                          <button onClick={() => navigate(`/medios/ordenes-costo/${order.id}/editar`)} style={{ padding: 0, border: 'none', background: 'transparent', color: 'var(--brand,#0891b2)', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>#{order.id}</button>
                        ) : (
                          <span style={{ color: 'var(--brand,#0891b2)', fontWeight: 800 }}>#{order.id}</span>
                        )}
                        <div style={{ color: 'var(--muted,#64748b)', fontFamily: 'inherit', fontSize: 11, marginTop: 3 }}>{formatDate(order.fecha)}</div>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 220 }}>{order.cliente || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 220 }}>{order.proveedor || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 200 }}>{order.campana || '—'}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{order.usuario || '—'}</td>
                      <td style={{ padding: '13px 16px' }}><StatusBadge estado={order.estado} color={order.estadoColor} /></td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 600, color: 'var(--fg,#0f172a)', whiteSpace: 'nowrap' }}>{fmtMoneyFull(order.total)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        {visibleActions.length > 0 ? (
                          <button
                            title="Acciones"
                            aria-label="Acciones"
                            onClick={(e) => { const rc = e.currentTarget.getBoundingClientRect(); setMenu({ id: order.id, actions: visibleActions, x: rc.right, y: rc.bottom }); }}
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
                  );})}
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
            {ACTION_CATALOG.filter((a) => menu.actions.includes(a.code)).map((a) => {
              const order = items.find((item) => item.id === menu.id);
              const label = a.code === 'add-obs' && order?.hasFinalObservation ? 'Ver observación' : a.label;
              return (
              <button
                key={a.code}
                onClick={() => {
                  const orderId = menu.id;
                  setMenu(null);
                  if (a.code === 'edit') navigate(`/medios/ordenes-costo/${orderId}/editar`);
                  if (a.code === 'print') window.open(`/medios/ordenes-costo/${orderId}/imprimir?autoprint=1`, '_blank', 'noopener,noreferrer');
                  if (a.code === 'finish' && finishing === null) setConfirmAction({ orderId, action: 'finish' });
                  if (a.code === 'anule' && savingAction === null) setConfirmAction({ orderId, action: 'anule' });
                  if (a.code === 'replace' && savingAction === null) setConfirmAction({ orderId, action: 'replace' });
                  if (a.code === 'add-obs') openFinalObservation(orderId);
                }}
                disabled={(a.code === 'finish' && finishing !== null) || ((a.code === 'anule' || a.code === 'replace') && savingAction !== null)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: (a.code === 'finish' && finishing !== null) || ((a.code === 'anule' || a.code === 'replace') && savingAction !== null) ? 'default' : 'pointer', textAlign: 'left', transition: 'background .12s', color: a.danger ? '#ef4444' : 'var(--fg-2,#334155)', opacity: (a.code === 'finish' && finishing !== null) || ((a.code === 'anule' || a.code === 'replace') && savingAction !== null) ? .55 : 1 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Icon d={a.icon} size={16} sw={1.8} />{a.code === 'finish' && finishing === menu.id ? 'Finalizando…' : savingAction?.orderId === menu.id && savingAction.action === a.code ? 'Procesando…' : label}
              </button>
            );})}
          </div>
        </>
      )}

      {finalObs && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 18 }}>
          <div role="dialog" aria-modal="true" style={{ width: 'min(520px, 100%)', background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>Observación</div>
                <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 4 }}>Orden de costo #{finalObs.orderId}</div>
              </div>
              <button type="button" onClick={closeFinalObservation} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'var(--surface-2,#f7f8fa)', color: 'var(--muted,#64748b)', cursor: finalObsSaving ? 'default' : 'pointer' }}>×</button>
            </div>

            <div style={{ padding: 20 }}>
              {finalObsError && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' }}>{finalObsError}</div>}
              <textarea
                value={finalObs.value}
                onChange={(event) => setFinalObs((current) => current ? { ...current, value: event.target.value } : current)}
                readOnly={finalObs.mode === 'view' || finalObsLoading}
                rows={4}
                maxLength={FINAL_OBSERVATION_MAX_LENGTH}
                placeholder={finalObsLoading ? 'Cargando observación…' : 'Escribí la observación final…'}
                style={{ ...input, minHeight: 104, resize: 'vertical', fontFamily: 'inherit', background: finalObs.mode === 'view' ? 'var(--surface-2,#f7f8fa)' : input.background }}
              />
              {finalObs.mode === 'add' && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted,#64748b)', textAlign: 'right' }}>{finalObs.value.trim().length}/{FINAL_OBSERVATION_MAX_LENGTH}</div>}
            </div>

            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={closeFinalObservation} style={{ height: 38, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: finalObsSaving ? 'default' : 'pointer' }}>{finalObs.mode === 'view' ? 'Cerrar' : 'Cancelar'}</button>
              {finalObs.mode === 'add' && (
                <button type="button" onClick={saveFinalObservation} disabled={finalObsLoading || finalObsSaving || !finalObs.value.trim()} style={{ height: 38, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: finalObsSaving ? 'wait' : !finalObs.value.trim() ? 'default' : 'pointer', opacity: finalObsLoading || finalObsSaving || !finalObs.value.trim() ? .65 : 1 }}>{finalObsSaving ? 'Guardando…' : 'Guardar'}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {duplicateOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 18 }}>
          <div role="dialog" aria-modal="true" style={{ width: 'min(760px, 100%)', maxHeight: '86vh', overflow: 'hidden', background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>Duplicar órdenes</div>
                <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 4 }}>Seleccioná órdenes de costo de los últimos 3 meses. Se copiarán cabecera y detalles, sin vínculos de presupuesto.</div>
              </div>
              <button type="button" onClick={closeDuplicate} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'var(--surface-2,#f7f8fa)', color: 'var(--muted,#64748b)', cursor: duplicateSaving ? 'default' : 'pointer' }}>×</button>
            </div>

            <div style={{ padding: 18, borderBottom: '1px solid var(--border,#e5e8ec)' }}>
              {duplicateError && <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' }}>{duplicateError}</div>}
              <input value={duplicateSearch} onChange={(event) => setDuplicateSearch(event.target.value)} placeholder="Buscar por orden, cliente, proveedor o campaña…" style={input} />
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted,#64748b)' }}>{duplicateSelected.size} seleccionada(s)</div>
            </div>

            <div style={{ overflow: 'auto', padding: 0 }}>
              {duplicateLoading ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted,#64748b)', fontSize: 13 }}>Cargando órdenes…</div>
              ) : duplicateCandidates.length ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                      <th style={{ ...th, width: 46 }}></th>
                      <th style={th}>Orden</th>
                      <th style={th}>Cliente</th>
                      <th style={th}>Proveedor</th>
                      <th style={th}>Campaña</th>
                      <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicateCandidates.map((order) => (
                      <tr key={order.id} onClick={() => toggleDuplicateSelection(order.id)} style={{ borderBottom: '1px solid var(--border,#e5e8ec)', cursor: 'pointer', background: duplicateSelected.has(order.id) ? 'rgba(8,145,178,.08)' : 'transparent' }}>
                        <td style={{ padding: '12px 16px' }}><input type="checkbox" checked={duplicateSelected.has(order.id)} onChange={() => toggleDuplicateSelection(order.id)} onClick={(event) => event.stopPropagation()} /></td>
                        <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono,monospace', fontWeight: 800, color: 'var(--brand,#0891b2)' }}>#{order.id}<div style={{ color: 'var(--muted,#64748b)', fontSize: 11, marginTop: 3 }}>{formatDate(order.fecha)}</div></td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{order.cliente || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{order.proveedor || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{order.campana || '—'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 600 }}>{fmtMoneyFull(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 34, textAlign: 'center', color: 'var(--muted,#64748b)', fontSize: 13 }}>No hay órdenes elegibles para duplicar con ese criterio.</div>
              )}
            </div>

            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={closeDuplicate} style={{ height: 38, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: duplicateSaving ? 'default' : 'pointer' }}>Cancelar</button>
              <button type="button" onClick={duplicateOrders} disabled={duplicateSaving || duplicateSelected.size === 0} style={{ height: 38, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: duplicateSaving ? 'wait' : duplicateSelected.size === 0 ? 'default' : 'pointer', opacity: duplicateSaving || duplicateSelected.size === 0 ? .65 : 1 }}>{duplicateSaving ? 'Duplicando…' : 'Duplicar seleccionadas'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDetails && (
        <ConfirmDialog
          open={!!confirmAction}
          title={confirmDetails.title}
          description={confirmDetails.description}
          confirmLabel={confirmDetails.confirmLabel}
          tone={confirmDetails.tone}
          loading={confirmDetails.loading}
          onConfirm={confirmDetails.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
