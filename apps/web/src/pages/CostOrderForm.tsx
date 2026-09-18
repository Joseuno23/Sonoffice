import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import ConfirmDialog from '../components/ConfirmDialog';
import { Icon } from '../lib/icons';
import { fmtMoneyFull } from '../lib/format';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e6e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', padding: '22px 24px' };
const lbl: CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 8 };
const inBase: CSSProperties = { width: '100%', height: 44, padding: '0 13px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const btnGhost: CSSProperties = { height: 40, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };
const detailTooltipBox: CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 'calc(100% + 8px)', zIndex: 100, padding: '10px 12px', borderRadius: 10, background: 'var(--fg,#0f172a)', color: 'var(--surface,#fff)', boxShadow: 'var(--shadow-lg)', fontSize: 12.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', pointerEvents: 'none' };
const detailIconButton: CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 999, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', display: 'grid', placeItems: 'center', cursor: 'help', padding: 0 };
const infoIconPath = 'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z';
const linkedIconPath = 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71';

interface Option { id: number; label: string; }
interface DetailLine { idDetalle?: number; detalle: string; cantidad: string; valor: string; totalCobrado?: number | null; faltante?: number | null; hasBudget?: boolean; budgetTipo?: number | null; budgetPpto?: number | null; budgetIdDetallePpto?: number | null; budgetValorAsignado?: number | null; }
interface BudgetLine { idPpto: number; idDetallePpto: number; detalle: string; total: number; valorAsignadoOc: number; ordenCosto: number; disponible: number; cantidad?: string; asignado?: string; }

const budgetTypes: Option[] = [
  { id: 1, label: 'Aviso' },
  { id: 2, label: 'Clasificado' },
  { id: 3, label: 'Revista' },
  { id: 4, label: 'Radio' },
  { id: 5, label: 'Televisión' },
  { id: 6, label: 'Externa' },
  { id: 7, label: 'Interna' },
  { id: 8, label: 'Publicidad Exterior' },
  { id: 9, label: 'Impresos' },
  { id: 10, label: 'Artículos Publicitarios' },
];

const budgetSourceTitle = (row: DetailLine) => row.hasBudget && row.budgetPpto
  ? `Detalle asociado al ppto #${row.budgetPpto}`
  : 'Item tomado de presupuesto';

// Select con búsqueda server-side (typeahead) para catálogos grandes (clientes 591, proveedores 4037).
function SearchSelect({ value, label, placeholder, disabled = false, fetcher, onSelect }: {
  value: Option | null;
  label: string;
  placeholder: string;
  disabled?: boolean;
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
      <button type="button" disabled={disabled} onClick={() => { if (!disabled) setOpen((o) => !o); }} style={{ ...inBase, textAlign: 'left', cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: value ? 'var(--fg,#0f172a)' : 'var(--muted,#94a3b8)', background: disabled ? 'var(--surface-2,#f7f8fa)' : inBase.background }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ? value.label : placeholder}</span>
        <Icon d="M6 9l6 6 6-6" size={16} sw={2} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: 4, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>
          <div style={{ padding: 8, borderBottom: '1px solid var(--border,#e5e8ec)' }}>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" disabled={disabled} style={{ ...inBase, height: 38 }} />
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
  const location = useLocation();
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
  const [porcIva, setPorcIva] = useState('');
  const [porcDescuento, setPorcDescuento] = useState('0');
  const [cobrado, setCobrado] = useState(0);
  const [faltante, setFaltante] = useState(0);
  const [detalles, setDetalles] = useState<DetailLine[]>([{ detalle: '', cantidad: '1', valor: '' }]);
  const [budgetTipo, setBudgetTipo] = useState('');
  const [budgetPpto, setBudgetPpto] = useState('');
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetSaving, setBudgetSaving] = useState<number | null>(null);
  const [budgetSubmitted, setBudgetSubmitted] = useState(false);
  const [deletingDetail, setDeletingDetail] = useState<number | null>(null);
  const [permittedActions, setPermittedActions] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [detailTooltip, setDetailTooltip] = useState<{ key: string; text: string } | null>(null);

  useEffect(() => {
    const state = location.state as { createdOrderMessage?: string } | null;
    if (!isEdit || !state?.createdOrderMessage) return;
    setMessage({ type: 'success', text: state.createdOrderMessage });
    navigate(location.pathname, { replace: true, state: null });
  }, [isEdit, location.pathname, location.state, navigate]);

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
        setPorcIva(o.porcIva === null || o.porcIva === undefined ? '' : String(o.porcIva));
        setPorcDescuento(String(o.porcDescuento ?? 0));
        setCobrado(Number(o.cobrado ?? 0));
        setFaltante(Number(o.faltante ?? 0));
        setDetalles(o.detalles.length ? o.detalles.map((d: any) => ({ idDetalle: d.idDetalle, detalle: d.detalle, cantidad: String(d.cantidad), valor: String(d.valor), totalCobrado: d.totalCobrado ?? 0, faltante: d.faltante ?? null, hasBudget: !!d.hasBudget, budgetTipo: d.budgetTipo ?? null, budgetPpto: d.budgetPpto ?? null, budgetIdDetallePpto: d.budgetIdDetallePpto ?? null, budgetValorAsignado: d.budgetValorAsignado ?? null })) : [{ detalle: '', cantidad: '1', valor: '' }]);
        setPermittedActions(o.permittedActions || []);
      })
      .catch(() => { if (live) setMessage({ type: 'error', text: 'No se pudo cargar la orden.' }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  // En creación, el IVA viene de sys_data_billing; edición conserva el valor guardado en la orden.
  useEffect(() => {
    if (isEdit) return;
    let live = true;
    api.getCostOrderDefaults()
      .then((res) => {
        if (!live) return;
        if (res?.success) setPorcIva(res.data?.porcIva === null || res.data?.porcIva === undefined ? '' : String(res.data.porcIva));
        else setMessage({ type: 'error', text: res?.message || 'No se pudo cargar el IVA configurado.' });
      })
      .catch(() => { if (live) setMessage({ type: 'error', text: 'No se pudo cargar el IVA configurado.' }); });
    return () => { live = false; };
  }, [isEdit]);

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
    setBudgetLines([]);
    if (!isEdit) setDetalles((list) => list.filter((line) => !line.hasBudget));
  };
  const onProveedorChange = (opt: Option | null) => {
    setProveedor(opt);
    setBudgetLines([]);
    if (!isEdit) setDetalles((list) => list.filter((line) => !line.hasBudget));
  };
  const onTipoChange = (t: 'I' | 'E') => {
    setTipo(t);
    setIdServicio('');
    setBudgetLines([]);
    if (!isEdit) setDetalles((list) => list.filter((line) => !line.hasBudget));
  };

  const setLine = (i: number, k: keyof DetailLine, v: string) =>
    setDetalles((list) => list.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLine = () => setDetalles((list) => [...list, { detalle: '', cantidad: '1', valor: '' }]);
  const refreshDetails = () => {
    if (!isEdit) return;
    api.getCostOrder(id).then((fresh) => {
      if (!fresh?.success) return;
      setCobrado(Number(fresh.data.cobrado ?? 0));
      setFaltante(Number(fresh.data.faltante ?? 0));
      setDetalles(fresh.data.detalles.length ? fresh.data.detalles.map((d: any) => ({ idDetalle: d.idDetalle, detalle: d.detalle, cantidad: String(d.cantidad), valor: String(d.valor), totalCobrado: d.totalCobrado ?? 0, faltante: d.faltante ?? null, hasBudget: !!d.hasBudget, budgetTipo: d.budgetTipo ?? null, budgetPpto: d.budgetPpto ?? null, budgetIdDetallePpto: d.budgetIdDetallePpto ?? null, budgetValorAsignado: d.budgetValorAsignado ?? null })) : [{ detalle: '', cantidad: '1', valor: '' }]);
    }).catch(() => undefined);
  };
  const removeLine = (i: number) => {
    if (!editable) return;
    const line = detalles[i];
    if (line?.hasBudget && isEdit && line.idDetalle) {
      setDeletingDetail(line.idDetalle);
      setMessage(null);
      api.deleteCostOrderDetail(id, line.idDetalle)
        .then((res) => {
          if (res?.success) { setMessage({ type: 'success', text: res.message || 'Detalle eliminado.' }); refreshDetails(); }
          else setMessage({ type: 'error', text: res?.message || 'No se pudo eliminar el detalle.' });
        })
        .catch(() => setMessage({ type: 'error', text: 'No se pudo eliminar el detalle.' }))
        .finally(() => setDeletingDetail(null));
      return;
    }
    setDetalles((list) => { const arr = list.filter((_, idx) => idx !== i); return arr.length ? arr : [{ detalle: '', cantidad: '1', valor: '' }]; });
  };

  const lineTotal = (l: DetailLine) => (Number(l.valor) || 0) * (Number(l.cantidad) || 0);
  const valor = useMemo(() => detalles.reduce((s, l) => s + lineTotal(l), 0), [detalles]);
  const descuento = valor * (Number(porcDescuento) || 0) / 100;
  const iva = (valor - descuento) * (Number(porcIva) || 0) / 100;
  const total = valor - descuento + iva;
  const visibleCobrado = isEdit ? cobrado : 0;
  const visibleFaltante = isEdit ? faltante : Math.max(valor, 0);

  const validDetails = detalles.filter((l) => !l.hasBudget && l.detalle.trim() && Number(l.cantidad) > 0 && Number(l.valor) >= 0);
  const budgetDetails = detalles.filter((l) => l.hasBudget && l.budgetTipo && l.budgetPpto && l.budgetIdDetallePpto && Number(l.cantidad) > 0 && Number(l.budgetValorAsignado) > 0);
  const currentBudgetTipo = !isEdit ? budgetDetails[0]?.budgetTipo ?? null : null;
  const hasBudgetDetails = budgetDetails.length > 0;
  const canSubmit = editable && !!cliente && !!proveedor && !!idServicio && !!idCampana && !!idProducto && (validDetails.length > 0 || hasBudgetDetails);

  const searchBudget = () => {
    if (!editable) return;
    if (budgetLoading) return;
    setBudgetSubmitted(true);
    if (!isEdit && (!cliente || !proveedor)) {
      setBudgetLines([]);
      setMessage({ type: 'error', text: 'Selecciona cliente y proveedor antes de buscar presupuesto.' });
      return;
    }
    if (!budgetTipo) {
      setBudgetLines([]);
      setMessage({ type: 'error', text: 'Selecciona el tipo de presupuesto antes de buscar.' });
      return;
    }
    if (!budgetPpto) {
      setBudgetLines([]);
      setMessage({ type: 'error', text: 'Ingresa el número de presupuesto antes de buscar.' });
      return;
    }
    if (currentBudgetTipo && Number(budgetTipo) !== currentBudgetTipo) {
      setBudgetLines([]);
      setMessage({ type: 'error', text: 'Esta orden fue creada para presupuestos de otro tipo' });
      return;
    }
    setBudgetLoading(true);
    setMessage(null);
    const request = isEdit
      ? api.getCostOrderBudgetLines(id, budgetTipo, budgetPpto)
      : api.getCostOrderBudgetLinesForCreate({ idCliente: cliente?.id, idProveedor: proveedor?.id, tipo: budgetTipo, ppto: budgetPpto });
    request
      .then((res) => {
        if (res?.success) {
          const lines = res.data || [];
          setBudgetLines(lines.map((l: BudgetLine) => ({ ...l, cantidad: '1', asignado: String(Number(l.disponible) > 0 ? l.disponible : 0) })));
          if (lines.length === 0) setMessage({ type: 'error', text: res.message || 'No hay información disponible.' });
        }
        else { setBudgetLines([]); setMessage({ type: 'error', text: res?.message || 'No se pudo consultar el presupuesto.' }); }
      })
      .catch(() => { setBudgetLines([]); setMessage({ type: 'error', text: 'No se pudo consultar el presupuesto.' }); })
      .finally(() => setBudgetLoading(false));
  };

  const setBudgetLine = (i: number, k: 'cantidad' | 'asignado', v: string) =>
    setBudgetLines((list) => list.map((line, idx) => (idx === i ? { ...line, [k]: v } : line)));

  const attachBudget = (line: BudgetLine) => {
    if (!editable) return;
    if (budgetSaving || !budgetTipo || !budgetPpto) return;
    const cantidad = Number(line.cantidad) || 1;
    const valorAsignado = Number(line.asignado) || 0;
    if (!isEdit) {
      if (currentBudgetTipo && Number(budgetTipo) !== currentBudgetTipo) {
        setMessage({ type: 'error', text: 'Esta orden fue creada para presupuestos de otro tipo' });
        return;
      }
      const exists = detalles.some((detail) => detail.hasBudget && detail.budgetTipo === Number(budgetTipo) && detail.budgetPpto === Number(budgetPpto) && detail.budgetIdDetallePpto === line.idDetallePpto);
      if (exists) {
        setMessage({ type: 'error', text: 'Este item ya existe en la orden de costo.' });
        return;
      }
      setDetalles((list) => {
        const next = list.filter((detail) => detail.hasBudget || detail.detalle.trim() || Number(detail.valor) > 0);
        return [...next, {
          detalle: line.detalle,
          cantidad: String(cantidad),
          valor: String(valorAsignado / cantidad),
          hasBudget: true,
          budgetTipo: Number(budgetTipo),
          budgetPpto: Number(budgetPpto),
          budgetIdDetallePpto: line.idDetallePpto,
          budgetValorAsignado: valorAsignado,
        }];
      });
      setMessage({ type: 'success', text: 'Detalle de presupuesto agregado a la orden.' });
      setBudgetLines((list) => list.filter((item) => item.idDetallePpto !== line.idDetallePpto));
      return;
    }
    setBudgetSaving(line.idDetallePpto);
    setMessage(null);
    api.attachCostOrderBudgetLine(id, {
      tipo: Number(budgetTipo),
      ppto: Number(budgetPpto),
      idDetallePpto: line.idDetallePpto,
      detalle: line.detalle,
      cantidad,
      valorAsignado,
    })
      .then((res) => {
        if (res?.success) {
          setMessage({ type: 'success', text: res.message || 'Detalle de presupuesto agregado.' });
          setBudgetLines([]);
          refreshDetails();
        } else {
          setMessage({ type: 'error', text: res?.message || 'No se pudo agregar el presupuesto.' });
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo agregar el presupuesto.' }))
      .finally(() => setBudgetSaving(null));
  };

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
      porcIva: porcIva === '' ? null : Number(porcIva),
      porcDescuento: Number(porcDescuento),
      detalles: validDetails.map((l) => ({ detalle: l.detalle.trim(), cantidad: Number(l.cantidad), valor: Number(l.valor) })),
      budgetDetails: budgetDetails.map((l) => ({ tipo: l.budgetTipo, ppto: l.budgetPpto, idDetallePpto: l.budgetIdDetallePpto, cantidad: Number(l.cantidad), valorAsignado: Number(l.budgetValorAsignado) })),
    };
    const call = isEdit ? api.updateCostOrder(id, payload) : api.createCostOrder(payload);
    call
      .then((res) => {
        if (res?.success) {
          if (!isEdit && res.data?.id) {
            const createdMessage = res.message || `Orden #${res.data.id} creada correctamente. Ya podés revisarla o ajustarla desde esta pantalla.`;
            navigate(`/medios/ordenes-costo/${res.data.id}/editar`, { state: { createdOrderMessage: createdMessage } });
            return;
          }
          setMessage({ type: 'success', text: res.message || 'Orden actualizada.' });
        } else {
          setMessage({ type: 'error', text: res?.message || 'No se pudo guardar la orden.' });
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo guardar la orden.' }))
      .finally(() => setSaving(false));
  };

  const finalizeOrder = () => {
    if (!isEdit || !editable || finishing) return;
    setFinishing(true);
    setMessage(null);
    api.finalizeCostOrder(id)
      .then((res) => {
        if (res?.success) {
          setMessage({ type: 'success', text: res.message || 'Orden finalizada.' });
          return api.getCostOrder(id).then((fresh) => {
            if (!fresh?.success) return;
            setEstado(fresh.data.estado);
            setEditable(fresh.data.editable);
            setCobrado(Number(fresh.data.cobrado ?? 0));
            setFaltante(Number(fresh.data.faltante ?? 0));
            setPermittedActions(fresh.data.permittedActions || []);
          });
        }
        setMessage({ type: 'error', text: res?.message || 'No se pudo finalizar la orden.' });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo finalizar la orden.' }))
      .finally(() => { setFinishing(false); setFinishConfirmOpen(false); });
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
            <span style={{ color: 'var(--fg-2,#334155)', fontWeight: 600 }}>{isEdit ? `${editable ? 'Editar' : 'Ver'} #${id}` : 'Nueva'}</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 5px', color: 'var(--fg,#0f172a)' }}>{isEdit ? `${editable ? 'Editar' : 'Ver'} orden de costo #${id}` : 'Nueva orden de costo'}</h1>
          <p style={{ margin: 0, color: 'var(--muted,#64748b)', fontSize: 14 }}>{isEdit ? (editable ? 'Modifica la información y el detalle de la orden.' : 'Consulta la información y el detalle de la orden.') : 'Completa la información y agrega el detalle de la orden.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/medios/ordenes-costo/listar')} style={btnGhost}><Icon d="M18 6L6 18M6 6l12 12" size={16} sw={2} />{editable ? 'Cancelar' : 'Volver'}</button>
          {editable && (
            <button onClick={submit} disabled={!canSubmit || saving} style={{ height: 40, padding: '0 18px', border: 'none', background: canSubmit ? 'var(--primary,#0f172a)' : 'var(--border-strong,#d5d9e0)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: canSubmit && !saving ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" size={16} sw={1.8} />{saving ? 'Guardando…' : 'Guardar orden'}
            </button>
          )}
          {isEdit && editable && permittedActions.includes('finish') && (
            <button onClick={() => setFinishConfirmOpen(true)} disabled={finishing} style={{ height: 40, padding: '0 18px', border: 'none', background: 'var(--primary,#0f172a)', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: finishing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: finishing ? .7 : 1 }}>
              <Icon d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" size={16} sw={1.9} />{finishing ? 'Finalizando…' : 'Finalizar orden'}
            </button>
          )}
        </div>
      </div>

      {isEdit && !editable && (
        <div style={{ marginBottom: 16, padding: '11px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: '#b45309', background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.22)' }}>
          Esta orden está en estado <b>{estado || '—'}</b> y es de solo lectura. Solo las órdenes en estado borrador (Activo) pueden editarse.
        </div>
      )}

      {message && <AlertMessage type={message.type} style={{ marginBottom: 16, fontSize: 13.5 }}>{message.text}</AlertMessage>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.85fr) minmax(320px, 1fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'contents' }}>
          <div style={{ ...card, order: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Información general</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 18px' }}>Datos principales de la orden</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
              <SearchSelect value={cliente} label="Cliente" placeholder="Selecciona un cliente" disabled={!editable} fetcher={api.getCostOrderClients} onSelect={onClienteChange} />
              <SearchSelect value={proveedor} label="Proveedor" placeholder="Selecciona un proveedor" disabled={!editable} fetcher={api.getCostOrderProviders} onSelect={onProveedorChange} />
              <div>
                <label style={lbl}>Tipo de orden <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={tipo} onChange={(e) => onTipoChange(e.target.value as 'I' | 'E')} disabled={!editable} style={{ ...inBase, background: !editable ? 'var(--surface-2,#f7f8fa)' : inBase.background }}>
                  <option value="I">Interna</option>
                  <option value="E">Externa</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Servicio <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={idServicio} onChange={(e) => setIdServicio(e.target.value)} disabled={!editable} style={{ ...inBase, background: !editable ? 'var(--surface-2,#f7f8fa)' : inBase.background }}>
                  <option value="">Selecciona un servicio</option>
                  {servicios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Campaña <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={idCampana} onChange={(e) => setIdCampana(e.target.value)} disabled={!editable || !cliente} style={{ ...inBase, background: !editable || !cliente ? 'var(--surface-2,#f7f8fa)' : inBase.background }}>
                  <option value="">{cliente ? 'Selecciona una campaña' : 'Elige un cliente primero'}</option>
                  {campanas.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Producto <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={idProducto} onChange={(e) => setIdProducto(e.target.value)} disabled={!editable || !cliente} style={{ ...inBase, background: !editable || !cliente ? 'var(--surface-2,#f7f8fa)' : inBase.background }}>
                  <option value="">{cliente ? 'Selecciona un producto' : 'Elige un cliente primero'}</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ ...card, order: 3, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Detalle</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 16px' }}>Líneas de la orden de costo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {detalles.map((row, i) => {
                const detailKey = `detail-${i}`;
                const budgetKey = `budget-${i}`;
                return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: editable ? 'minmax(220px, 1fr) 68px 120px 150px 44px' : 'minmax(220px, 1fr) 68px 120px 150px', gap: 10, alignItems: 'center' }}>
                  <div
                    style={{ position: 'relative', minWidth: 0, zIndex: detailTooltip?.key === detailKey || detailTooltip?.key === budgetKey ? 20 : 1 }}
                  >
                    <input
                      value={row.detalle}
                      onChange={(e) => setLine(i, 'detalle', e.target.value)}
                      disabled={!editable || row.hasBudget}
                      placeholder={'Detalle ' + (i + 1)}
                      style={{ ...inBase, paddingRight: row.detalle.trim() ? row.hasBudget ? 72 : 42 : row.hasBudget ? 42 : inBase.padding, background: !editable || row.hasBudget ? 'var(--surface-2,#f7f8fa)' : inBase.background }}
                    />
                    {detailTooltip?.key === detailKey || detailTooltip?.key === budgetKey ? (
                      <div style={detailTooltipBox}>
                        {detailTooltip.text}
                      </div>
                    ) : null}
                    {row.detalle.trim() && (
                      <button
                        type="button"
                        aria-label="Ver detalle completo"
                        onMouseEnter={() => setDetailTooltip({ key: detailKey, text: row.detalle })}
                        onMouseLeave={() => setDetailTooltip((current) => current?.key === detailKey ? null : current)}
                        onFocus={() => setDetailTooltip({ key: detailKey, text: row.detalle })}
                        onBlur={() => setDetailTooltip((current) => current?.key === detailKey ? null : current)}
                        style={{ ...detailIconButton, right: row.hasBudget ? 38 : 10, color: 'var(--fg-2,#334155)' }}
                      >
                        <Icon d={infoIconPath} size={14} sw={2} />
                      </button>
                    )}
                    {row.hasBudget && (
                      <button type="button" aria-label={budgetSourceTitle(row)} onMouseEnter={() => setDetailTooltip({ key: budgetKey, text: budgetSourceTitle(row) })} onMouseLeave={() => setDetailTooltip((current) => current?.key === budgetKey ? null : current)} onFocus={() => setDetailTooltip({ key: budgetKey, text: budgetSourceTitle(row) })} onBlur={() => setDetailTooltip((current) => current?.key === budgetKey ? null : current)} style={{ ...detailIconButton, right: 10, color: 'var(--primary,#0f172a)' }}>
                        <Icon d={linkedIconPath} size={14} sw={1.8} />
                      </button>
                    )}
                  </div>
                  <input value={row.cantidad} onChange={(e) => setLine(i, 'cantidad', e.target.value.replace(/[^0-9]/g, ''))} disabled={!editable || row.hasBudget} title="Cantidad" style={{ ...inBase, width: '100%', textAlign: 'center', background: !editable || row.hasBudget ? 'var(--surface-2,#f7f8fa)' : inBase.background }} />
                  <input value={row.valor} onChange={(e) => setLine(i, 'valor', e.target.value.replace(/[^0-9.]/g, ''))} disabled={!editable || row.hasBudget} placeholder="Valor" style={{ ...inBase, width: '100%', background: !editable || row.hasBudget ? 'var(--surface-2,#f7f8fa)' : inBase.background }} />
                  <div style={{ minWidth: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--muted,#64748b)', textTransform: 'uppercase', letterSpacing: '.03em' }}>Total</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-2,#334155)', fontFamily: 'JetBrains Mono,monospace', whiteSpace: 'nowrap' }}>{fmtMoneyFull(lineTotal(row))}</div>
                  </div>
                  {editable && <button onClick={() => removeLine(i)} disabled={!!row.idDetalle && deletingDetail === row.idDetalle} style={{ width: 44, height: 44, flex: 'none', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', borderRadius: 10, color: row.hasBudget ? '#2563eb' : '#ef4444', cursor: deletingDetail ? 'default' : 'pointer', display: 'grid', placeItems: 'center', opacity: !!row.idDetalle && deletingDetail === row.idDetalle ? .55 : 1 }} title={row.hasBudget ? 'Eliminar y liberar presupuesto' : 'Eliminar línea'}>
                      <Icon d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" size={16} sw={1.9} />
                  </button>}
                </div>
              );})}
            </div>
            {editable && (
              <button onClick={addLine} style={{ marginTop: 14, ...btnGhost, display: 'inline-flex' }}>
                <Icon d="M12 5v14M5 12h14" size={16} sw={2} />Agregar línea
              </button>
            )}
          </div>

          {editable && (
            <div style={{ ...card, order: 4, gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Presupuesto</div>
              <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 16px' }}>Busca un presupuesto existente y agrega líneas disponibles a esta orden.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                <div><label style={lbl}>Tipo de presupuesto</label><select value={budgetTipo} onChange={(e) => setBudgetTipo(e.target.value)} disabled={!!currentBudgetTipo} style={{ ...inBase, borderColor: budgetSubmitted && !budgetTipo ? '#ef4444' : 'var(--border-strong,#d5d9e0)' }}><option value="">Selecciona tipo</option>{budgetTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                <div><label style={lbl}>Número</label><input value={budgetPpto} onChange={(e) => setBudgetPpto(e.target.value.replace(/[^0-9]/g, ''))} style={{ ...inBase, borderColor: budgetSubmitted && !budgetPpto ? '#ef4444' : 'var(--border-strong,#d5d9e0)' }} /></div>
                <button onClick={searchBudget} disabled={budgetLoading} style={{ ...btnGhost, height: 44 }}>{budgetLoading ? 'Buscando…' : 'Buscar'}</button>
              </div>
              {budgetLines.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {budgetLines.map((line, i) => (
                    <div key={line.idDetallePpto} style={{ padding: 12, border: '1px solid var(--border,#e5e8ec)', borderRadius: 14, background: 'var(--surface,#fff)', overflow: 'hidden' }}>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ marginBottom: 6, fontSize: 11.5, fontWeight: 800, color: 'var(--muted,#64748b)', textTransform: 'uppercase', letterSpacing: '.03em' }}>Detalle</div>
                        <textarea value={line.detalle} readOnly rows={3} style={{ width: '100%', minHeight: 72, padding: '10px 11px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg-2,#334155)', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', minWidth: 0 }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '140px 110px minmax(150px,1fr) 96px', gap: 10, alignItems: 'end' }}>
                        <div>
                          <label style={lbl}>Total</label>
                          <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 11px', borderRadius: 10, border: '1px solid var(--border,#e5e8ec)', background: 'rgba(15,23,42,.05)', fontSize: 12.5, fontWeight: 800, color: 'var(--fg,#0f172a)', fontFamily: 'JetBrains Mono,monospace', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>{fmtMoneyFull(line.total)}</div>
                        </div>
                        <div><label style={lbl}>Cantidad OC</label><input value={line.cantidad || ''} onChange={(e) => setBudgetLine(i, 'cantidad', e.target.value.replace(/[^0-9]/g, ''))} style={{ ...inBase, height: 38, textAlign: 'center' }} /></div>
                        <div><label style={lbl}>Valor a asignar</label><input value={line.asignado || ''} onChange={(e) => setBudgetLine(i, 'asignado', e.target.value.replace(/[^0-9.]/g, ''))} style={{ ...inBase, height: 38 }} /></div>
                        <button onClick={() => attachBudget(line)} disabled={budgetSaving !== null || Number(line.asignado) <= 0 || Number(line.asignado) > Number(line.disponible)} style={{ ...btnGhost, height: 38, justifyContent: 'center', padding: '0 12px' }}>{budgetSaving === line.idDetallePpto ? '...' : 'Agregar'}</button>
                      </div>
                      {Number(line.disponible) < Number(line.total) && <div style={{ marginTop: 8, fontSize: 12, color: Number(line.disponible) <= 0 ? '#b91c1c' : 'var(--muted,#64748b)' }}>{Number(line.disponible) <= 0 ? `Sin saldo disponible${line.ordenCosto ? `: ya está asociado a la OC #${line.ordenCosto}` : ''}.` : `Disponible para asignar: ${fmtMoneyFull(line.disponible)}`}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ ...card, order: 5, gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Observación</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 16px' }}>Información adicional (opcional)</div>
            <textarea value={observacion} onChange={(e) => setObservacion(e.target.value)} disabled={!editable} placeholder="Escribe cualquier detalle relevante…" rows={4} style={{ width: '100%', padding: '12px 13px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: !editable ? 'var(--surface-2,#f7f8fa)' : 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, order: 2 }}>
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 16 }}>Valores</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div><label style={lbl}>Descuento %</label><input value={porcDescuento} onChange={(e) => setPorcDescuento(e.target.value.replace(/[^0-9.]/g, ''))} disabled={!editable} style={{ ...inBase, background: !editable ? 'var(--surface-2,#f7f8fa)' : inBase.background }} /></div>
              <div><label style={lbl}>IVA %</label><input value={porcIva} onChange={(e) => setPorcIva(e.target.value.replace(/[^0-9.]/g, ''))} disabled={!editable} style={{ ...inBase, background: !editable ? 'var(--surface-2,#f7f8fa)' : inBase.background }} /></div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2,#334155)' }}>
                <span>Cobrado</span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>{fmtMoneyFull(visibleCobrado)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2,#334155)' }}>
                <span>Faltante</span>
                <span style={{ fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>{fmtMoneyFull(visibleFaltante)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={finishConfirmOpen}
        title="Finalizar orden de costo"
        description="Al finalizar no podrás modificar ni agregar más items a la orden."
        confirmLabel="Finalizar orden"
        tone="warning"
        loading={finishing}
        onConfirm={finalizeOrder}
        onCancel={() => setFinishConfirmOpen(false)}
      />
    </div>
  );
}
