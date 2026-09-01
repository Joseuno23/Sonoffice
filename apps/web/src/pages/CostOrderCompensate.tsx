import { useEffect, useState, type CSSProperties } from 'react';
import AlertMessage from '../components/AlertMessage';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import { fmtMoneyFull } from '../lib/format';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const td: CSSProperties = { padding: '12px 14px', borderBottom: '1px solid var(--border,#e5e8ec)', fontSize: 13, color: 'var(--fg-2,#334155)', verticalAlign: 'top' };
const input: CSSProperties = { width: '100%', height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const primary: CSSProperties = { height: 40, padding: '0 16px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' };
const ghost: CSSProperties = { height: 40, padding: '0 14px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const compactTable: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' };
const detailCell: CSSProperties = { ...td, minWidth: 0, overflow: 'hidden' };
interface OrderDetail { idDetalle: number; detalle: string; total: number; totalCobrado: number; faltante: number; }
interface CostOrder { id: number; idEstado: number | null; estado: string | null; cliente: string | null; proveedor: string | null; total: number; cobrado: number; faltante: number; }
interface BudgetLine { idDetallePpto: number; detalle: string; total: number; valorAsignadoOc: number; ordenCosto: number; disponible: number; }
interface BudgetType { id: number; label: string; }
interface Suggestion { idDetalleOrden: number; idDetallePpto: number; orderDetail: string; budgetDetail: string; suggestedValue: number; confidence: 'Alta' | 'Media' | 'Baja'; reason: string; conflict: boolean; includeInBulk: boolean; }
interface Association { associationId: number | null; idDetalleOrden: number; idDetallePpto: number; idPpto: number; modulo: number; tipoLabel: string | null; cobradoItem: number; orderDetail: string | null; budgetDetail: string | null; }
interface AssociationInput { idDetalleOrden: number; idDetallePpto: number; valor: number; }

function Badge({ value, conflict }: { value: string; conflict?: boolean }) {
  const color = conflict ? '#b91c1c' : value === 'Alta' ? '#047857' : value === 'Media' ? '#b45309' : '#475569';
  const bg = conflict ? 'rgba(239,68,68,.10)' : value === 'Alta' ? 'rgba(16,185,129,.12)' : value === 'Media' ? 'rgba(245,158,11,.14)' : 'rgba(148,163,184,.16)';
  return <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, color, background: bg }}>{conflict ? 'Conflicto' : value}</span>;
}

function DetailPreview({ text, max = 96 }: { text?: string | null; max?: number }) {
  const value = text || 'Sin detalle';
  const truncated = value.length > max ? value.slice(0, max).trimEnd() + '...' : value;
  return <span title={value} style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom', whiteSpace: 'nowrap' }}>{truncated}{value.length > max && <span aria-label="Detalle completo" style={{ marginLeft: 6, color: 'var(--muted,#64748b)', fontWeight: 800 }}>ⓘ</span>}</span>;
}

export default function CostOrderCompensate() {
  const [orderId, setOrderId] = useState('');
  const [tipo, setTipo] = useState('');
  const [ppto, setPpto] = useState('');
  const [budgetTypes, setBudgetTypes] = useState<BudgetType[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [order, setOrder] = useState<CostOrder | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmMassive, setConfirmMassive] = useState(false);
  const [confirmReverse, setConfirmReverse] = useState<Association | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    api.getCostOrderCompensateContext()
      .then((res) => {
        if (!active || !res?.success) return;
        setBudgetTypes(res.data?.budgetTypes || []);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const loadContext = async ({ preserveMessage = false }: { preserveMessage?: boolean } = {}) => {
    setLoading(true);
    if (!preserveMessage) setMessage(null);
    setSuggestions([]);
    try {
      const res = await api.getCostOrderCompensateContext({ orderId, tipo, ppto });
      if (!res?.success) {
        setMessage({ type: 'error', text: res?.message || 'No se pudo consultar la compensación.' });
        return null;
      }
      setOrder(res.data.order);
      setOrderDetails(res.data.orderDetails || []);
      setBudgetLines(res.data.budgetLines || []);
      setAssociations(res.data.associations || []);
      setBudgetTypes(res.data.budgetTypes || []);
      setSelected({});
      return res.data.order as CostOrder | null;
    } catch {
      setMessage({ type: 'error', text: 'No se pudo consultar la compensación.' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const suggest = () => {
    setLoading(true);
    setMessage(null);
    api.suggestCostOrderCompensation({ orderId: Number(orderId), tipo: Number(tipo), ppto: Number(ppto) })
      .then((res) => {
        if (res?.success) setSuggestions(res.data || []);
        else setMessage({ type: 'error', text: res?.message || 'No se pudo sugerir compensación.' });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo sugerir compensación.' }))
      .finally(() => setLoading(false));
  };

  const saveAssociations = async (nextAssociations: AssociationInput[]) => {
    if (saving || !nextAssociations.length) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.associateCostOrderCompensation({ orderId: Number(orderId), tipo: Number(tipo), ppto: Number(ppto), associations: nextAssociations });
      if (res?.success) {
        const refreshedOrder = await loadContext({ preserveMessage: true });
        const finalized = Number(refreshedOrder?.idEstado) === 8 || Number(refreshedOrder?.faltante || 0) <= 0;
        setMessage({ type: 'success', text: finalized ? 'Compensación guardada. La orden quedó finalizada.' : (res.message || 'Compensación guardada.') });
      } else {
        setMessage({ type: 'error', text: res?.message || 'No se pudo guardar la compensación.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'No se pudo guardar la compensación.' });
    } finally {
      setSaving(false);
      setConfirmBulk(false);
      setConfirmMassive(false);
    }
  };

  const saveManual = (detail: OrderDetail) => {
    const budgetId = Number(selected[detail.idDetalle + ':budget']);
    const valor = Number(selected[detail.idDetalle + ':value']);
    if (!budgetId || !valor) return;
    saveAssociations([{ idDetalleOrden: detail.idDetalle, idDetallePpto: budgetId, valor }]);
  };

  const reverseAssociation = async () => {
    if (saving || !confirmReverse?.associationId || !order) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.reverseCostOrderCompensationAssociation({ orderId: order.id, associationId: confirmReverse.associationId });
      if (res?.success) {
        await loadContext({ preserveMessage: true });
        setMessage({ type: 'success', text: res.message || 'Asociación reversada correctamente.' });
      } else {
        setMessage({ type: 'error', text: res?.message || 'No se pudo reversar la asociación.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'No se pudo reversar la asociación.' });
    } finally {
      setSaving(false);
      setConfirmReverse(null);
    }
  };

  const selectedBudgetLine = (detail: OrderDetail) => budgetLines.find((line) => String(line.idDetallePpto) === selected[detail.idDetalle + ':budget']);

  const maxAssociationValue = (detail: OrderDetail) => {
    const line = selectedBudgetLine(detail);
    return line ? Math.min(Number(line.disponible || 0), Number(detail.faltante || 0)) : 0;
  };

  const moneyInputValue = (value: number) => Number.isFinite(value) ? String(Math.max(0, Math.round(value * 100) / 100)) : '';

  const selectBudgetLine = (detail: OrderDetail, idDetallePpto: string) => {
    const line = budgetLines.find((item) => String(item.idDetallePpto) === idDetallePpto);
    setSelected((current) => ({
      ...current,
      [detail.idDetalle + ':budget']: idDetallePpto,
      [detail.idDetalle + ':value']: line ? moneyInputValue(Math.min(line.disponible, detail.faltante)) : '',
    }));
  };

  const setAssociationValue = (detail: OrderDetail, rawValue: string) => {
    const line = selectedBudgetLine(detail);
    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    const value = Number(cleaned);
    const maxValue = line ? maxAssociationValue(detail) : 0;
    const nextValue = line && Number.isFinite(value) && value > maxValue
      ? moneyInputValue(maxValue)
      : cleaned;
    setSelected((current) => ({ ...current, [detail.idDetalle + ':value']: nextValue }));
  };

  const bulkSuggestions = suggestions
    .filter((s) => s.includeInBulk)
    .map((s) => ({ idDetalleOrden: s.idDetalleOrden, idDetallePpto: s.idDetallePpto, valor: s.suggestedValue }));

  const availableBudgetLines = budgetLines.filter((line) => line.disponible > 0);
  const onlyOrderDetail = orderDetails.length === 1 ? orderDetails[0] : null;
  const orderUnavailable = !!order && ([8, 25, 4].includes(Number(order.idEstado)) || Number(order.faltante || 0) <= 0);
  const associationUnavailable = !order || orderUnavailable;
  const reverseUnavailable = !order || [25, 4].includes(Number(order.idEstado));
  const canAssociateMultiple = !associationUnavailable && !!onlyOrderDetail && onlyOrderDetail.faltante > 0 && availableBudgetLines.length > 0;

  const saveAutomaticMultiple = () => {
    if (!canAssociateMultiple || !onlyOrderDetail) return;
    let remaining = Number(onlyOrderDetail.faltante || 0);
    const nextAssociations: AssociationInput[] = [];
    for (const line of availableBudgetLines) {
      if (remaining <= 0) break;
      const value = Math.min(Number(line.disponible || 0), remaining);
      if (value <= 0) continue;
      nextAssociations.push({
        idDetalleOrden: onlyOrderDetail.idDetalle,
        idDetallePpto: line.idDetallePpto,
        valor: Number(value.toFixed(2)),
      });
      remaining = Number((remaining - value).toFixed(2));
    }
    saveAssociations(nextAssociations);
  };

  const associationsByOrderDetail = associations.reduce<Record<number, { detail: string | null; rows: Association[]; total: number }>>((acc, association) => {
    const id = association.idDetalleOrden;
    const current = acc[id] || { detail: association.orderDetail, rows: [], total: 0 };
    current.rows.push(association);
    current.total += association.cobradoItem;
    acc[id] = current;
    return acc;
  }, {});

  return (
    <>
      <PageHeader crumb="Medios · Órdenes de costo" title="Compensar costos" sub="Asocia detalles existentes de una orden de costo contra detalles de presupuesto sin crear nuevos items." />

      {message && <AlertMessage type={message.type} style={{ fontWeight: 700, border: message.type === 'success' ? '1px solid rgba(16,185,129,.20)' : undefined }}>{message.text}</AlertMessage>}

      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '160px 1fr 160px auto auto', gap: 12, alignItems: 'end' }}>
          <div><label style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted,#64748b)' }}>Orden</label><input value={orderId} onChange={(e) => setOrderId(e.target.value.replace(/[^0-9]/g, ''))} style={input} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted,#64748b)' }}>Tipo / categoría</label><select value={tipo} onChange={(e) => setTipo(e.target.value)} style={input}><option value="">Selecciona</option>{budgetTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          <div><label style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted,#64748b)' }}>Presupuesto</label><input value={ppto} onChange={(e) => setPpto(e.target.value.replace(/[^0-9]/g, ''))} style={input} /></div>
          <button onClick={() => loadContext()} disabled={loading || !orderId} style={{ ...ghost, opacity: loading || !orderId ? .6 : 1 }}>Consultar</button>
          <button onClick={suggest} disabled={loading || orderUnavailable || !orderId || !tipo || !ppto} style={{ ...primary, opacity: loading || orderUnavailable || !orderId || !tipo || !ppto ? .6 : 1 }}>Sugerir compensación</button>
        </div>
      </div>

      {order && <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 12, background: orderUnavailable ? 'rgba(16,185,129,.10)' : 'rgba(8,145,178,.08)', color: 'var(--fg-2,#334155)', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', border: orderUnavailable ? '1px solid rgba(16,185,129,.22)' : 'none' }}><div><b>Orden #{order.id}</b> · {order.cliente || 'Sin cliente'} · {order.proveedor || 'Sin proveedor'} · Estado: <b>{order.estado || '—'}</b> · Faltante: <b>{fmtMoneyFull(order.faltante)}</b>{orderUnavailable ? ' · No disponible para nuevas asociaciones' : ''}</div>{canAssociateMultiple && <button onClick={() => setConfirmMassive(true)} disabled={saving} style={{ ...primary, opacity: saving ? .6 : 1 }}>Asociar múltiple</button>}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ padding: '15px 16px', borderBottom: '1px solid var(--border,#e5e8ec)', fontWeight: 850 }}>Detalles de la orden</div>
          <div>{orderDetails.map((detail) => (
            <div key={detail.idDetalle} style={{ padding: '14px 16px', borderBottom: '1px solid var(--border,#e5e8ec)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--fg-2,#334155)' }}><DetailPreview text={detail.detalle} max={82} /></div>
                  <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--muted,#64748b)' }}>Total {fmtMoneyFull(detail.total)} · cobrado {fmtMoneyFull(detail.totalCobrado)}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 132 }}>
                  <div style={{ fontSize: 11, fontWeight: 850, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', marginBottom: 4 }}>Faltante</div>
                  <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 14, fontWeight: 850, color: 'var(--fg,#0f172a)' }}>{fmtMoneyFull(detail.faltante)}</div>
                </div>
              </div>
              {!associationUnavailable && detail.faltante > 0 && (
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(120px, .9fr) minmax(130px, 1fr) auto', gap: 8, alignItems: 'center' }}>
                  <select value={selected[detail.idDetalle + ':budget'] || ''} onChange={(e) => selectBudgetLine(detail, e.target.value)} style={{ ...input, height: 36 }}>
                    <option value="">Presupuesto</option>{budgetLines.filter((b) => b.disponible > 0).map((b) => <option key={b.idDetallePpto} value={b.idDetallePpto}>#{b.idDetallePpto}</option>)}
                  </select>
                  <input value={selected[detail.idDetalle + ':value'] || ''} onChange={(e) => setAssociationValue(detail, e.target.value)} placeholder="Valor" max={maxAssociationValue(detail) || undefined} title={selectedBudgetLine(detail) ? `Máximo permitido: ${fmtMoneyFull(maxAssociationValue(detail))}` : 'Selecciona un ítem del presupuesto'} style={{ ...input, height: 36 }} />
                  <button onClick={() => saveManual(detail)} disabled={saving} style={{ ...ghost, height: 36, opacity: saving ? .6 : 1 }}>Asociar</button>
                </div>
              )}
            </div>
          ))}</div>
        </div>

        <div style={card}>
          <div style={{ padding: '15px 16px', borderBottom: '1px solid var(--border,#e5e8ec)', fontWeight: 850 }}>Detalles del presupuesto</div>
          <div style={{ maxHeight: 430, overflow: 'auto' }}>{budgetLines.map((line) => <div key={line.idDetallePpto} style={{ padding: 14, borderBottom: '1px solid var(--border,#e5e8ec)', fontSize: 13 }}><b>#{line.idDetallePpto}</b> <DetailPreview text={line.detalle} max={120} /><div style={{ marginTop: 6, color: line.disponible <= 0 ? '#b91c1c' : 'var(--muted,#64748b)' }}>Disponible: <b>{fmtMoneyFull(line.disponible)}</b> · Total: {fmtMoneyFull(line.total)}{line.ordenCosto ? ` · OC #${line.ordenCosto}` : ''}</div></div>)}</div>
        </div>
      </div>

      {order && (
        <div style={{ ...card, marginTop: 18 }}>
          <div style={{ padding: '15px 16px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <b>Resumen asociado</b>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted,#64748b)' }}>{associations.length} asociación(es)</span>
          </div>
          {associations.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--muted,#64748b)' }}>Esta orden todavía no tiene detalles asociados en el contexto consultado.</div>
          ) : (
            <div>
              <table style={compactTable}>
                <thead><tr style={{ background: 'var(--surface-2,#f7f8fa)' }}><th style={{ ...th, width: '30%' }}>Detalle orden</th><th style={{ ...th, width: '52%' }}>Detalle(s) presupuesto</th><th style={{ ...th, width: '18%', textAlign: 'right' }}>Total asociado</th></tr></thead>
                <tbody>{Object.entries(associationsByOrderDetail).map(([idDetalleOrden, group]) => (
                  <tr key={idDetalleOrden}>
                    <td style={detailCell}><b>#{idDetalleOrden}</b> <DetailPreview text={group.detail} max={70} /></td>
                    <td style={detailCell}>{group.rows.map((association, index) => (
                      <div key={`${association.modulo}-${association.idPpto}-${association.idDetallePpto}-${index}`} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'start' }}>
                          <div><b>{association.tipoLabel || `Tipo ${association.modulo}`} #{association.idPpto}</b> · detalle #{association.idDetallePpto} · <b>{fmtMoneyFull(association.cobradoItem)}</b></div>
                          <button onClick={() => setConfirmReverse(association)} disabled={saving || reverseUnavailable || !association.associationId} title={!association.associationId ? 'No hay identificador único para reversar este ítem' : 'Reversar asociación'} style={{ ...ghost, height: 30, padding: '0 10px', fontSize: 12, opacity: saving || reverseUnavailable || !association.associationId ? .55 : 1 }}>Reversar</button>
                        </div>
                        <div style={{ marginTop: 3, color: 'var(--muted,#64748b)' }}><DetailPreview text={association.budgetDetail} max={82} /></div>
                      </div>
                    ))}</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontWeight: 800 }}>{fmtMoneyFull(group.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ ...card, marginTop: 18 }}>
          <div style={{ padding: '15px 16px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <b>Sugerencias</b>
            <button onClick={() => setConfirmBulk(true)} disabled={saving || associationUnavailable || bulkSuggestions.length === 0} style={{ ...primary, opacity: saving || associationUnavailable || bulkSuggestions.length === 0 ? .6 : 1 }}>Asociar todo ({bulkSuggestions.length})</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead><tr style={{ background: 'var(--surface-2,#f7f8fa)' }}><th style={th}>Detalle orden</th><th style={th}>Detalle presupuesto</th><th style={{ ...th, textAlign: 'right' }}>Valor</th><th style={th}>Confianza</th><th style={th}>Razón</th><th style={th}></th></tr></thead>
              <tbody>{suggestions.map((s) => <tr key={`${s.idDetalleOrden}-${s.idDetallePpto}`}><td style={td}><DetailPreview text={s.orderDetail} /></td><td style={td}><DetailPreview text={s.budgetDetail} /></td><td style={{ ...td, textAlign: 'right', fontFamily: 'JetBrains Mono,monospace', fontWeight: 800 }}>{fmtMoneyFull(s.suggestedValue)}</td><td style={td}><Badge value={s.confidence} conflict={s.conflict} /></td><td style={td}>{s.reason}</td><td style={td}><button onClick={() => saveAssociations([{ idDetalleOrden: s.idDetalleOrden, idDetallePpto: s.idDetallePpto, valor: s.suggestedValue }])} disabled={saving || associationUnavailable || s.conflict} style={{ ...ghost, height: 34, opacity: saving || associationUnavailable || s.conflict ? .6 : 1 }}>Aplicar</button></td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmMassive} title="Asociar múltiple" description="Se asociará el único detalle de la orden con los ítems disponibles del presupuesto, en el orden mostrado, hasta cubrir el faltante o agotar el saldo disponible. El último ítem puede quedar recortado automáticamente." confirmLabel="Asociar múltiple" tone="warning" loading={saving} onConfirm={saveAutomaticMultiple} onCancel={() => setConfirmMassive(false)} />
      <ConfirmDialog open={confirmBulk} title="Asociar sugerencias" description="Se guardarán solo sugerencias de confianza alta/media, sin conflictos y con saldo disponible. Las sugerencias bajas quedan fuera." confirmLabel="Asociar todo" tone="warning" loading={saving} onConfirm={() => saveAssociations(bulkSuggestions)} onCancel={() => setConfirmBulk(false)} />
      <ConfirmDialog open={!!confirmReverse} title="Reversar asociación" description={confirmReverse ? `Se reversará el presupuesto #${confirmReverse.idPpto}, detalle #${confirmReverse.idDetallePpto}, por ${fmtMoneyFull(confirmReverse.cobradoItem)}. Esta acción libera el saldo asociado.` : ''} confirmLabel="Reversar" tone="danger" loading={saving} onConfirm={reverseAssociation} onCancel={() => setConfirmReverse(null)} />
    </>
  );
}
