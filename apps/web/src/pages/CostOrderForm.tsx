import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { fmtMoneyFull } from '../lib/format';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e6e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', padding: '22px 24px' };
const lbl: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 8 };
const inBase: CSSProperties = { width: '100%', height: 44, padding: '0 13px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const btnGhost: CSSProperties = { height: 40, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };

interface Option { id: number; label: string; }
interface DetailLine { detalle: string; cantidad: string; valor: string; }

// Select con búsqueda server-side (typeahead) para catálogos grandes (clientes 591, proveedores 4037).
function SearchSelect({ value, label, placeholder, fetcher, onSelect }: {
  value: Option | null;
  label: string;
  placeholder: string;
  fetcher: (search: string) => Promise<any>;
  onSelect: (opt: Option | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setLoading(true);
      fetcher(q.trim())
        .then((res) => setOptions(res?.success ? res.data || [] : []))
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <label style={lbl}>{label} <span style={{ color: '#ef4444' }}>*</span></label>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ ...inBase, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: value ? 'var(--fg,#0f172a)' : 'var(--muted,#94a3b8)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ? value.label : placeholder}</span>
        <Icon d="M6 9l6 6 6-6" size={16} sw={2} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border,#e5e8ec)' }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ ...inBase, height: 38 }} />
          </div>
          <div style={{ maxHeight: 240, overflowY: 'auto', padding: 6 }}>
            {loading ? <div style={{ padding: 12, fontSize: 13, color: 'var(--muted,#64748b)' }}>Buscando…</div>
              : options.length ? options.map((opt) => (
                <button key={opt.id} type="button" onClick={() => { onSelect(opt); setOpen(false); setQ(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 7, fontSize: 13, color: 'var(--fg-2,#334155)', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>{opt.label}</button>
              )) : <div style={{ padding: 12, fontSize: 13, color: 'var(--muted,#64748b)' }}>Escribe para buscar.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CostOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [editable, setEditable] = useState(true);
  const [estado, setEstado] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Option | null>(null);
  const [proveedor, setProveedor] = useState<Option | null>(null);
  const [tipo, setTipo] = useState<'I' | 'E'>('I');
  const [servicios, setServicios] = useState<Option[]>([]);
  const [idServicio, setIdServicio] = useState('');
  const [campanas, setCampanas] = useState<Option[]>([]);
  const [idCampana, setIdCampana] = useState('');
  const [productos, setProductos] = useState<Option[]>([]);
  const [idProducto, setIdProducto] = useState('');
  const [observacion, setObservacion] = useState('');
  const [porcIva, setPorcIva] = useState('19');
  const [porcDescuento, setPorcDescuento] = useState('0');
  const [detalles, setDetalles] = useState<DetailLine[]>([{ detalle: '', cantidad: '1', valor: '' }]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Carga la orden en modo edición.
  useEffect(() => {
    if (!isEdit) return;
    let live = true;
    setLoading(true);
    api.getCostOrder(id)
      .then((res) => {
        if (!live) return;
        if (!res?.success) { setMessage({ type: 'error', text: res?.message || 'No se pudo cargar la orden.' }); return; }
        const o = res.data;
        setEstado(o.estado);
        setEditable(o.editable);
        setCliente(o.idCliente ? { id: o.idCliente, label: o.cliente || `Cliente ${o.idCliente}` } : null);
        setProveedor(o.idProveedor ? { id: o.idProveedor, label: o.proveedor || `Proveedor ${o.idProveedor}` } : null);
        setTipo(o.tipo === 'EXTERNA' ? 'E' : 'I');
        setIdServicio(o.idServicio ? String(o.idServicio) : '');
        setIdCampana(o.idCampana ? String(o.idCampana) : '');
        setIdProducto(o.idProducto ? String(o.idProducto) : '');
        setObservacion(o.observacion || '');
        setPorcIva(String(o.porcIva ?? 19));
        setPorcDescuento(String(o.porcDescuento ?? 0));
        setDetalles(o.detalles.length ? o.detalles.map((d: any) => ({ detalle: d.detalle, cantidad: String(d.cantidad), valor: String(d.valor) })) : [{ detalle: '', cantidad: '1', valor: '' }]);
      })
      .catch(() => { if (live) setMessage({ type: 'error', text: 'No se pudo cargar la orden.' }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  // Cargar OPCIONES de servicios cuando cambia el tipo. (No resetea la selección: eso lo hace onChange.)
  useEffect(() => {
    api.getCostOrderServices(tipo).then((res) => setServicios(res?.success ? res.data || [] : [])).catch(() => setServicios([]));
  }, [tipo]);

  // Cargar OPCIONES de campañas + productos cuando cambia el cliente. (No resetea la selección.)
  useEffect(() => {
    if (!cliente) { setCampanas([]); setProductos([]); return; }
    api.getCostOrderCampaigns(cliente.id).then((res) => setCampanas(res?.success ? res.data || [] : [])).catch(() => setCampanas([]));
    api.getCostOrderProducts(cliente.id).then((res) => setProductos(res?.success ? res.data || [] : [])).catch(() => setProductos([]));
  }, [cliente]);

  // Cambios explícitos del usuario: al cambiar cliente/tipo, SÍ reseteamos las selecciones dependientes.
  const onClienteChange = (opt: Option | null) => {
    setCliente(opt);
    setIdCampana('');
    setIdProducto('');
  };
  const onTipoChange = (t: 'I' | 'E') => {
    setTipo(t);
    setIdServicio('');
  };

  const setLine = (i: number, k: keyof DetailLine, v: string) =>
    setDetalles((list) => list.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLine = () => setDetalles((list) => [...list, { detalle: '', cantidad: '1', valor: '' }]);
  const removeLine = (i: number) => setDetalles((list) => { const arr = list.filter((_, idx) => idx !== i); return arr.length ? arr : [{ detalle: '', cantidad: '1', valor: '' }]; });

  const lineTotal = (l: DetailLine) => (Number(l.valor) || 0) * (Number(l.cantidad) || 0);
  const valor = useMemo(() => detalles.reduce((s, l) => s + lineTotal(l), 0), [detalles]);
  const descuento = valor * (Number(porcDescuento) || 0) / 100;
  const iva = (valor - descuento) * (Number(porcIva) || 0) / 100;
  const total = valor - descuento + iva;

  const validDetails = detalles.filter((l) => l.detalle.trim() && Number(l.cantidad) > 0 && Number(l.valor) >= 0);
  const canSubmit = editable && !!cliente && !!proveedor && !!idServicio && !!idCampana && !!idProducto && validDetails.length > 0;

  const submit = () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setMessage(null);
    const payload = {
      idCliente: cliente!.id,
      idProveedor: proveedor!.id,
      idServicio: Number(idServicio),
      idCampana: Number(idCampana),
      idProducto: Number(idProducto),
      tipo,
      observacion,
      porcIva: Number(porcIva),
      porcDescuento: Number(porcDescuento),
      detalles: validDetails.map((l) => ({ detalle: l.detalle.trim(), cantidad: Number(l.cantidad), valor: Number(l.valor) })),
    };
    const call = isEdit ? api.updateCostOrder(id, payload) : api.createCostOrder(payload);
    call
      .then((res) => {
        if (res?.success) {
          setMessage({ type: 'success', text: res.message || (isEdit ? 'Orden actualizada.' : 'Orden creada.') });
          setTimeout(() => navigate('/medios/ordenes-costo/listar'), 900);
        } else {
          setMessage({ type: 'error', text: res?.message || 'No se pudo guardar la orden.' });
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo guardar la orden.' }))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted,#64748b)', fontSize: 14 }}>Cargando orden…</div>;
  }

  return (
    <div style={{ animation: 'scfade .35s ease', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted,#64748b)', marginBottom: 11 }}>
            <a href="/medios/ordenes-costo/listar" onClick={(e) => { e.preventDefault(); navigate('/medios/ordenes-costo/listar'); }} style={{ color: 'var(--muted,#64748b)', textDecoration: 'none' }}>Órdenes de costo</a>
            <span style={{ color: 'var(--faint,#94a3b8)' }}>›</span>
            <span style={{ color: 'var(--fg-2,#334155)', fontWeight: 600 }}>{isEdit ? `Editar #${id}` : 'Nueva'}</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 5px', color: 'var(--fg,#0f172a)' }}>{isEdit ? `Editar orden de costo #${id}` : 'Nueva orden de costo'}</h1>
          <p style={{ margin: 0, color: 'var(--muted,#64748b)', fontSize: 14 }}>{isEdit ? 'Modifica la información y el detalle de la orden.' : 'Completa la información y agrega el detalle de la orden.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/medios/ordenes-costo/listar')} style={btnGhost}><Icon d="M18 6L6 18M6 6l12 12" size={16} sw={2} />{editable ? 'Cancelar' : 'Volver'}</button>
          {editable && (
            <button onClick={submit} disabled={!canSubmit || saving} style={{ height: 40, padding: '0 18px', border: 'none', background: canSubmit ? 'var(--primary,#0f172a)' : 'var(--border-strong,#d5d9e0)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: canSubmit && !saving ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" size={16} sw={1.8} />{saving ? 'Guardando…' : 'Guardar orden'}
            </button>
          )}
        </div>
      </div>

      {isEdit && !editable && (
        <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: '#b45309', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.22)' }}>
          Esta orden está en estado <b>{estado || '—'}</b> y es de solo lectura. Solo las órdenes en estado borrador (Activo) pueden editarse.
        </div>
      )}

      {message && (
        <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: message.type === 'error' ? '#b91c1c' : '#047857', background: message.type === 'error' ? 'rgba(239,68,68,.10)' : 'rgba(16,185,129,.12)', border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,.18)' : 'rgba(16,185,129,.18)'}` }}>{message.text}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Información general</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 18px' }}>Datos principales de la orden</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
              <SearchSelect value={cliente} label="Cliente" placeholder="Selecciona un cliente" fetcher={api.getCostOrderClients} onSelect={onClienteChange} />
              <SearchSelect value={proveedor} label="Proveedor" placeholder="Selecciona un proveedor" fetcher={api.getCostOrderProviders} onSelect={setProveedor} />
              <div>
                <label style={lbl}>Tipo de orden <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={tipo} onChange={(e) => onTipoChange(e.target.value as 'I' | 'E')} style={inBase}>
                  <option value="I">Interna</option>
                  <option value="E">Externa</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Servicio <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={idServicio} onChange={(e) => setIdServicio(e.target.value)} style={inBase}>
                  <option value="">Selecciona un servicio</option>
                  {servicios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Campaña <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={idCampana} onChange={(e) => setIdCampana(e.target.value)} disabled={!cliente} style={inBase}>
                  <option value="">{cliente ? 'Selecciona una campaña' : 'Elige un cliente primero'}</option>
                  {campanas.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Producto <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={idProducto} onChange={(e) => setIdProducto(e.target.value)} disabled={!cliente} style={inBase}>
                  <option value="">{cliente ? 'Selecciona un producto' : 'Elige un cliente primero'}</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Detalle</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 16px' }}>Líneas de la orden de costo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {detalles.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input value={row.detalle} onChange={(e) => setLine(i, 'detalle', e.target.value)} placeholder={'Detalle ' + (i + 1)} style={{ ...inBase, flex: 1, minWidth: 0 }} />
                  <input value={row.cantidad} onChange={(e) => setLine(i, 'cantidad', e.target.value.replace(/[^0-9]/g, ''))} title="Cantidad" style={{ ...inBase, width: 74, flex: 'none', textAlign: 'center' }} />
                  <input value={row.valor} onChange={(e) => setLine(i, 'valor', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="Valor" style={{ ...inBase, width: 130, flex: 'none' }} />
                  <div style={{ width: 130, flex: 'none', fontSize: 13, fontWeight: 600, color: 'var(--fg-2,#334155)', textAlign: 'right', fontFamily: 'JetBrains Mono,monospace' }}>{fmtMoneyFull(lineTotal(row))}</div>
                  <button onClick={() => removeLine(i)} style={{ width: 44, height: 44, flex: 'none', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', borderRadius: 10, color: '#ef4444', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                    <Icon d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" size={16} sw={1.9} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addLine} style={{ marginTop: 14, ...btnGhost, display: 'inline-flex' }}>
              <Icon d="M12 5v14M5 12h14" size={16} sw={2} />Agregar línea
            </button>
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Observación</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 16px' }}>Información adicional (opcional)</div>
            <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Escribe cualquier detalle relevante…" rows={4} style={{ width: '100%', padding: '12px 13px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 16 }}>Valores</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div><label style={lbl}>Descuento %</label><input value={porcDescuento} onChange={(e) => setPorcDescuento(e.target.value.replace(/[^0-9.]/g, ''))} style={inBase} /></div>
              <div><label style={lbl}>IVA %</label><input value={porcIva} onChange={(e) => setPorcIva(e.target.value.replace(/[^0-9.]/g, ''))} style={inBase} /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
              {[['Valor', valor], ['Descuento', -descuento], ['IVA', iva]].map(([k, v]) => (
                <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2,#334155)' }}>
                  <span>{k}</span>
                  <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>{fmtMoneyFull(v as number)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border,#e5e8ec)', fontSize: 15, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>
                <span>Total</span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{fmtMoneyFull(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
