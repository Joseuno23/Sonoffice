import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';

const card = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e6e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', padding: '22px 24px' };
const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 8 };
const inBase = { width: '100%', height: 44, padding: '0 13px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', transition: 'all .15s' };
const focusIn = (e) => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,.12)'; };
const blurIn = (e) => { e.target.style.borderColor = 'var(--border-strong,#d5d9e0)'; e.target.style.boxShadow = 'none'; };
const btnGhost = { height: 40, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .14s' };

const CLIENTES = ['Comercial del Norte S.A.', 'Carnes Frías Zenú', 'Postobón', 'Grupo Éxito', 'Bavaria', 'Alpina', 'Nutresa'];
const RESPS = ['M. González', 'Omar Salas', 'Laura Méndez', 'Carlos Ruiz', 'Andrea Gómez'];

export default function OrderForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ cliente: 'Comercial del Norte S.A.', ref: '', resp: 'M. González', emision: '2024-05-12', vencimiento: '2024-05-26', moneda: 'USD — Dólar', estadoInicial: 'Borrador', notificar: false, desc: '', conceptos: [{ desc: '', qty: '1', price: '' }, { desc: '', qty: '1', price: '' }] });
  const [formOk, setFormOk] = useState(false);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setC = (i, k) => (e) => setForm((f) => ({ ...f, conceptos: f.conceptos.map((c, idx) => (idx === i ? { ...c, [k]: e.target.value } : c)) }));
  const removeC = (i) => setForm((f) => { const arr = f.conceptos.filter((_, idx) => idx !== i); return { ...f, conceptos: arr.length ? arr : [{ desc: '', qty: '1', price: '' }] }; });
  const addC = () => setForm((f) => ({ ...f, conceptos: [...f.conceptos, { desc: '', qty: '1', price: '' }] }));

  const validations = [
    { ok: !!form.cliente, label: 'Cliente seleccionado' },
    { ok: !!(form.emision && form.vencimiento), label: 'Fechas válidas' },
    { ok: form.conceptos.some((c) => (c.price || '').trim()), label: 'Al menos un concepto con precio' },
  ];

  const submit = () => setFormOk(true);

  return (
    <div style={{ animation: 'scfade .35s ease', maxWidth: 1180, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted,#64748b)', marginBottom: 11 }}>
            <a href="/ordenes" onClick={(e) => { e.preventDefault(); navigate('/ordenes'); }} style={{ color: 'var(--muted,#64748b)', textDecoration: 'none' }}>Ventas</a>
            <span style={{ color: 'var(--faint,#94a3b8)' }}>›</span>
            <a href="/ordenes" onClick={(e) => { e.preventDefault(); navigate('/ordenes'); }} style={{ color: 'var(--muted,#64748b)', textDecoration: 'none' }}>Órdenes</a>
            <span style={{ color: 'var(--faint,#94a3b8)' }}>›</span>
            <span style={{ color: 'var(--fg-2,#334155)', fontWeight: 600 }}>Nueva</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em', margin: '0 0 5px', color: 'var(--fg,#0f172a)' }}>Nueva orden de venta</h1>
          <p style={{ margin: 0, color: 'var(--muted,#64748b)', fontSize: 14 }}>Completa la información para registrar una nueva orden.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/ordenes')} style={btnGhost}><Icon d="M18 6L6 18M6 6l12 12" size={16} sw={2} />Cancelar</button>
          <button style={btnGhost}><Icon d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" size={16} sw={1.8} />Guardar borrador</button>
          <button onClick={submit} style={{ height: 40, padding: '0 18px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 16px -6px rgba(37,99,235,.5)', transition: 'background .14s' }}>
            <Icon d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8" size={16} sw={1.8} />Guardar orden
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Información general</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 18px' }}>Datos principales de la orden</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 18px' }}>
              <div><label style={lbl}>Cliente <span style={{ color: '#ef4444' }}>*</span></label><select value={form.cliente} onChange={setF('cliente')} style={inBase} onFocus={focusIn} onBlur={blurIn}>{CLIENTES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>Vendedor asignado <span style={{ color: '#ef4444' }}>*</span></label><select value={form.resp} onChange={setF('resp')} style={inBase} onFocus={focusIn} onBlur={blurIn}>{RESPS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label style={lbl}>Fecha de emisión <span style={{ color: '#ef4444' }}>*</span></label><input type="date" value={form.emision} onChange={setF('emision')} style={inBase} onFocus={focusIn} onBlur={blurIn} /></div>
              <div><label style={lbl}>Fecha de vencimiento <span style={{ color: '#ef4444' }}>*</span></label><input type="date" value={form.vencimiento} onChange={setF('vencimiento')} style={inBase} onFocus={focusIn} onBlur={blurIn} /></div>
              <div><label style={lbl}>Referencia</label><input value={form.ref} onChange={setF('ref')} placeholder="Ej. OC-cliente-2034" style={inBase} onFocus={focusIn} onBlur={blurIn} /></div>
              <div><label style={lbl}>Moneda</label><select value={form.moneda} onChange={setF('moneda')} style={inBase} onFocus={focusIn} onBlur={blurIn}><option>USD — Dólar</option><option>MXN — Peso</option><option>EUR — Euro</option><option>COP — Peso col.</option></select></div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Conceptos</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 16px' }}>Productos o servicios de la orden</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {form.conceptos.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input value={row.desc} onChange={setC(i, 'desc')} placeholder={'Descripción ' + (i + 1)} style={{ ...inBase, flex: 1, minWidth: 0 }} onFocus={focusIn} onBlur={blurIn} />
                  <input value={row.qty} onChange={setC(i, 'qty')} style={{ ...inBase, width: 74, flex: 'none', textAlign: 'center' }} onFocus={focusIn} onBlur={blurIn} />
                  <input value={row.price} onChange={setC(i, 'price')} placeholder="Precio" style={{ ...inBase, width: 120, flex: 'none' }} onFocus={focusIn} onBlur={blurIn} />
                  <button onClick={() => removeC(i)} style={{ width: 44, height: 44, flex: 'none', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', borderRadius: 10, color: '#ef4444', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all .14s' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fecaca'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface,#fff)'; e.currentTarget.style.borderColor = 'var(--border-strong,#d5d9e0)'; }}>
                    <Icon d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" size={16} sw={1.9} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addC} style={{ marginTop: 14, height: 40, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all .14s' }}>
              <Icon d="M12 5v14M5 12h14" size={16} sw={2} />Agregar concepto
            </button>
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Notas y observaciones</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', margin: '3px 0 16px' }}>Información adicional para el cliente</div>
            <label style={lbl}>Comentarios</label>
            <textarea value={form.desc} onChange={setF('desc')} placeholder="Escribe cualquier detalle relevante..." rows={4} style={{ width: '100%', padding: '12px 13px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', resize: 'vertical', transition: 'all .15s', fontFamily: 'inherit' }} onFocus={focusIn} onBlur={blurIn} />
          </div>
        </div>

        {/* right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 16 }}>Estado</div>
            <label style={lbl}>Estado inicial</label>
            <select value={form.estadoInicial} onChange={setF('estadoInicial')} style={inBase} onFocus={focusIn} onBlur={blurIn}><option>Borrador</option><option>Confirmada</option><option>Enviada</option><option>Pagada</option></select>
            <label onClick={() => setForm((f) => ({ ...f, notificar: !f.notificar }))} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginTop: 16, fontSize: 13.5, color: 'var(--fg-2,#334155)', userSelect: 'none' }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, flex: 'none', display: 'grid', placeItems: 'center', transition: 'all .15s', border: '1.5px solid ' + (form.notificar ? '#2563eb' : 'var(--border-strong,#d5d9e0)'), background: form.notificar ? '#2563eb' : 'transparent', color: form.notificar ? '#fff' : 'transparent' }}>
                <Icon d="M20 6L9 17l-5-5" size={12} sw={3} />
              </span>
              Notificar al cliente por correo
            </label>
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 14 }}>Archivos adjuntos</div>
            <div style={{ border: '1.5px dashed var(--border-strong,#d5d9e0)', borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#f7faff'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong,#d5d9e0)'; e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--surface-2,#f7f8fa)', display: 'grid', placeItems: 'center', margin: '0 auto 10px', color: 'var(--muted,#64748b)' }}>
                <Icon d="M16 16l-4-4-4 4M12 12v9M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" size={20} sw={1.7} />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg-2,#334155)' }}>Arrastra archivos aquí</div>
              <div style={{ fontSize: 12, color: 'var(--faint,#94a3b8)', marginTop: 3 }}>o haz clic para seleccionar (PDF, PNG, JPG)</div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 16 }}>Validación</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {validations.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, fontSize: 13.5, color: v.ok ? 'var(--fg-2,#334155)' : 'var(--muted,#64748b)' }}>
                  <span style={v.ok ? { width: 20, height: 20, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', background: '#dcfce7', color: '#16a34a' } : { width: 20, height: 20, borderRadius: '50%', flex: 'none', background: 'var(--surface-3,#f1f3f6)', border: '1px solid var(--border-strong,#d5d9e0)' }}>
                    {v.ok && <Icon d="M20 6L9 17l-5-5" size={12} sw={3} />}
                  </span>
                  {v.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {formOk && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 12, background: '#ecfdf3', border: '1px solid #bbf7d0', color: '#16a34a', fontSize: 13.5, fontWeight: 600, animation: 'scpop .25s ease' }}>
          <Icon d="M20 6L9 17l-5-5" size={18} sw={2.2} />Orden guardada correctamente (demo).
        </div>
      )}
    </div>
  );
}
