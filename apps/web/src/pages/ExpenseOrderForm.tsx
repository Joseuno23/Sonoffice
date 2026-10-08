import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import { fmtMoneyFull } from '../lib/format';
import { Icon } from '../lib/icons';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e6e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', padding: '22px 24px' };
const lbl: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 8 };
const inBase: CSSProperties = { width: '100%', minHeight: 44, padding: '0 13px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const btnGhost: CSSProperties = { height: 40, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };
const btnPrimary: CSSProperties = { height: 40, padding: '0 18px', border: 'none', borderRadius: 10, background: 'var(--primary,#0f172a)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };

interface Option { id: number; label: string; }
interface DetailLine { idDetalle?: number; detalle: string; valor: string; }

function SearchSelect({ value, label, disabled, fetcher, onSelect }: { value: Option | null; label: string; disabled?: boolean; fetcher: (search: string) => Promise<any>; onSelect: (option: Option | null) => void; }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => { if (!open) return; const timer = setTimeout(() => { fetcher(q.trim()).then((res) => setOptions(res?.success ? res.data || [] : [])).catch(() => setOptions([])); }, 250); return () => clearTimeout(timer); }, [q, open, fetcher]);
  useEffect(() => { const onClick = (event: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false); }; document.addEventListener('mousedown', onClick); return () => document.removeEventListener('mousedown', onClick); }, []);
  useEffect(() => { setHighlightedIndex(options.length ? 0 : -1); optionRefs.current = []; }, [options]);
  useEffect(() => { if (highlightedIndex >= 0) optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' }); }, [highlightedIndex]);

  const choose = (option: Option) => { onSelect(option); setOpen(false); setQ(''); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlightedIndex((current) => options.length ? Math.min(current + 1, options.length - 1) : -1); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlightedIndex((current) => options.length ? Math.max(current - 1, 0) : -1); }
    if (event.key === 'Enter' && highlightedIndex >= 0 && options[highlightedIndex]) { event.preventDefault(); choose(options[highlightedIndex]); }
    if (event.key === 'Escape') setOpen(false);
  };

  return <div ref={boxRef} style={{ position: 'relative' }}>
    <label style={lbl}>{label} <span style={{ color: '#ef4444' }}>*</span></label>
    <button type="button" disabled={disabled} onClick={() => !disabled && setOpen((current) => !current)} style={{ ...inBase, textAlign: 'left', cursor: disabled ? 'default' : 'pointer', background: disabled ? 'var(--surface-2,#f7f8fa)' : '#fff' }}>{value?.label || 'Selecciona un proveedor'}</button>
    {open && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, background: '#fff', border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ padding: 8 }}><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Buscar…" style={{ ...inBase, minHeight: 38 }} /></div>
      <div style={{ maxHeight: 240, overflowY: 'auto', padding: 6 }}>{options.length ? options.map((option, index) => <button key={option.id} ref={(el) => { optionRefs.current[index] = el; }} type="button" onClick={() => choose(option)} onMouseEnter={() => setHighlightedIndex(index)} style={{ width: '100%', border: 0, background: highlightedIndex === index ? 'var(--surface-2,#f7f8fa)' : 'transparent', textAlign: 'left', padding: '8px 10px', borderRadius: 7, cursor: 'pointer' }}>{option.label}</button>) : <div style={{ padding: 12, color: 'var(--muted,#64748b)', fontSize: 13 }}>Escribe para buscar.</div>}</div>
    </div>}
  </div>;
}

export default function ExpenseOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [editable, setEditable] = useState(true);
  const [estado, setEstado] = useState<string | null>(null);
  const [proveedor, setProveedor] = useState<Option | null>(null);
  const [observacion, setObservacion] = useState('');
  const [descuento, setDescuento] = useState('0');
  const [iva, setIva] = useState('');
  const [detalles, setDetalles] = useState<DetailLine[]>([{ detalle: '', valor: '' }]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isEdit) return; api.getExpenseOrderDefaults().then((res) => { if (res?.success) setIva(String(res.data.iva ?? 19)); else setIva('19'); }).catch(() => setIva('19')); }, [isEdit]);
  useEffect(() => { if (!isEdit) return; let live = true; setLoading(true); api.getExpenseOrder(id).then((res) => { if (!live) return; if (!res?.success) { setMessage({ type: 'error', text: res?.message || 'No se pudo cargar la orden.' }); return; } const o = res.data; setEditable(!!o.editable); setEstado(o.estado); setProveedor(o.idProveedor ? { id: o.idProveedor, label: o.proveedor || `Proveedor ${o.idProveedor}` } : null); setObservacion(o.observacion || ''); setDescuento(String(o.descuento ?? 0)); setIva(String(o.iva ?? 19)); setDetalles(o.detalles?.length ? o.detalles.map((d: any) => ({ idDetalle: d.idDetalle, detalle: d.detalle, valor: String(d.valor ?? '') })) : [{ detalle: '', valor: '' }]); }).catch(() => { if (live) setMessage({ type: 'error', text: 'No se pudo cargar la orden.' }); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [id, isEdit]);

  const setLine = (i: number, key: keyof DetailLine, value: string) => setDetalles((list) => list.map((line, index) => index === i ? { ...line, [key]: value } : line));
  const addLine = () => setDetalles((list) => [...list, { detalle: '', valor: '' }]);
  const removeLine = (i: number) => setDetalles((list) => { const next = list.filter((_, index) => index !== i); return next.length ? next : [{ detalle: '', valor: '' }]; });
  const valor = useMemo(() => detalles.reduce((sum, line) => sum + (Number(line.valor) || 0), 0), [detalles]);
  const valorDescuento = valor * (Number(descuento) || 0) / 100;
  const subtotal = valor - valorDescuento;
  const valorIva = subtotal * (Number(iva) || 0) / 100;
  const total = subtotal + valorIva;
  const canSubmit = editable && !!proveedor && !saving;

  const submit = () => {
    if (!canSubmit) return;
    const payload = {
      idProveedor: proveedor!.id,
      observacion,
      descuento: Number(descuento) || 0,
      iva: Number(iva) || 0,
      detalles: detalles
        .filter((line) => line.detalle.trim() || Number(line.valor) > 0)
        .map((line) => ({ idDetalle: line.idDetalle, detalle: line.detalle.trim(), cantidad: 1, valor: Number(line.valor) || 0 })),
    };
    setSaving(true); setMessage(null);
    const call = isEdit ? api.updateExpenseOrder(id, payload) : api.createExpenseOrder(payload);
    call.then((res) => { if (res?.success) { if (!isEdit && res.data?.id) { navigate(`/medios/ordenes-gastos/${res.data.id}/editar`); return; } setMessage({ type: 'success', text: res.message || 'Orden guardada correctamente.' }); } else setMessage({ type: 'error', text: res?.message || 'No se pudo guardar la orden.' }); })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo guardar la orden.' }))
      .finally(() => setSaving(false));
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Cargando orden…</div>;

  return <div style={{ maxWidth: 1080, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted,#64748b)', marginBottom: 11 }}>
          <a href="/medios/ordenes-gastos/listar" onClick={(e) => { e.preventDefault(); navigate('/medios/ordenes-gastos/listar'); }} style={{ color: 'var(--muted,#64748b)', textDecoration: 'none' }}>Órdenes de gastos</a>
          <span style={{ color: 'var(--faint,#94a3b8)' }}>›</span>
          <span style={{ color: 'var(--fg-2,#334155)', fontWeight: 600 }}>{isEdit ? `${editable ? 'Editar' : 'Ver'} #${id}` : 'Nueva'}</span>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 5px', color: 'var(--fg,#0f172a)' }}>{isEdit ? `${editable ? 'Editar' : 'Ver'} orden de gastos #${id}` : 'Nueva orden de gastos'}</h1>
        <p style={{ margin: 0, color: 'var(--muted,#64748b)', fontSize: 14 }}>{editable ? 'Completa la cabecera y el detalle de la orden.' : `Orden en estado ${estado || '—'} de solo lectura.`}</p>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button onClick={() => navigate('/medios/ordenes-gastos/listar')} style={btnGhost}>Volver</button>{editable && <button onClick={submit} disabled={!canSubmit} style={btnPrimary}>{saving ? 'Guardando…' : 'Guardar orden'}</button>}</div>
    </div>
    {message && <AlertMessage type={message.type} style={{ marginBottom: 16 }}>{message.text}</AlertMessage>}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(300px,.8fr)', gap: 20 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 18 }}>Información general</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <SearchSelect value={proveedor} label="Proveedor" disabled={!editable} fetcher={api.getExpenseOrderProviders} onSelect={setProveedor} />
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>Detalle</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {detalles.map((line, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: editable ? 'minmax(220px,1fr) 140px 44px' : 'minmax(220px,1fr) 140px', gap: 10 }}>
              <textarea value={line.detalle} onChange={(e) => setLine(i, 'detalle', e.target.value)} disabled={!editable} rows={1} placeholder={`Detalle ${i + 1}`} style={{ ...inBase, paddingTop: 11, resize: 'vertical', fontFamily: 'inherit', background: !editable ? 'var(--surface-2,#f7f8fa)' : '#fff' }} />
              <input value={line.valor} onChange={(e) => setLine(i, 'valor', e.target.value.replace(/[^0-9.]/g, ''))} disabled={!editable} placeholder="Valor" style={inBase} />
              {editable && <button onClick={() => removeLine(i)} style={{ width: 44, minHeight: 44, border: '1px solid var(--border-strong,#d5d9e0)', background: '#fff', borderRadius: 10, color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><Icon d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" size={16} sw={1.9} /></button>}
            </div>)}
          </div>
          {editable && <button onClick={addLine} style={{ ...btnGhost, marginTop: 12 }}><Icon d="M12 5v14M5 12h14" size={16} sw={2} /> Agregar detalle</button>}
        </div>
        <div style={card}>
          <label style={lbl}>Observación</label>
          <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} disabled={!editable} rows={3} style={{ ...inBase, paddingTop: 11, resize: 'vertical', fontFamily: 'inherit', background: !editable ? 'var(--surface-2,#f7f8fa)' : '#fff' }} />
        </div>
      </div>
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Valores</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}><div><label style={lbl}>Descuento %</label><input value={descuento} onChange={(e) => setDescuento(e.target.value.replace(/[^0-9.]/g, ''))} disabled={!editable} style={inBase} /></div><div><label style={lbl}>IVA %</label><input value={iva} onChange={(e) => setIva(e.target.value.replace(/[^0-9.]/g, ''))} disabled={!editable} style={inBase} /></div></div>
        {([['Valor', valor], ['Descuento', -valorDescuento], ['Subtotal', subtotal], ['IVA', valorIva]] as [string, number][]).map(([name, amount]) => <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5 }}><span>{name}</span><b>{fmtMoneyFull(amount)}</b></div>)}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 10, borderTop: '1px solid var(--border,#e5e8ec)', fontSize: 16, fontWeight: 900 }}><span>Total</span><span>{fmtMoneyFull(total)}</span></div>
      </div>
    </div>
  </div>;
}
