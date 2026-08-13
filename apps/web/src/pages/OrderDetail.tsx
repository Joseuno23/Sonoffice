import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useTheme } from '../theme/ThemeContext';
import { badgeStyle } from '../lib/status';
import { DetailSkeleton } from '../components/Skeletons';
import { api } from '../services/api';

const card = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e6e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)' };
const thCell = { textAlign: 'left', padding: '0 0 12px', fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--faint,#94a3b8)', borderBottom: '1px solid var(--border,#e6e8ec)' };
const wrapBlue = { width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', flex: 'none', background: '#eff4ff', color: '#2563eb' };
const wrapGreen = { ...wrapBlue, background: '#dcfce7', color: '#16a34a' };
const wrapAmber = { ...wrapBlue, background: '#fef3c7', color: '#d97706' };

const btnGhost = { height: 40, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .14s' };

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { dark: d } = useTheme();
  const [op, setOp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getOrder(id)
      .then((data) => { if (live) setOp(data); })
      .catch(() => { if (live) setOp(null); })
      .finally(() => { if (live) setTimeout(() => setLoading(false), 450); });
    return () => { live = false; };
  }, [id]);

  const timeline = [
    { title: 'Orden creada', sub: 'Por M. González', time: '12 May 2024 · 09:12', wrap: wrapBlue, icon: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5'], line: true },
    { title: 'Enviada al cliente', sub: 'Correo a Comercial del Norte S.A.', time: '12 May 2024 · 10:05', wrap: wrapBlue, icon: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'], line: true },
    { title: 'Orden aprobada', sub: 'Confirmada por el cliente', time: '13 May 2024 · 14:30', wrap: wrapGreen, icon: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4L12 14.01l-3-3'], line: true },
    { title: 'En preparación', sub: 'Almacén asignado', time: '14 May 2024 · 08:00', wrap: wrapAmber, icon: ['M21 8l-9-5-9 5 9 5 9-5z', 'M3 8v8l9 5 9-5V8', 'M12 13v8'], line: false },
  ];

  if (loading || !op) return <DetailSkeleton />;

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
            <span style={{ color: 'var(--fg-2,#334155)', fontWeight: 600 }}>{op.id}</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--fg,#0f172a)' }}>{op.id}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={btnGhost}><Icon d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" size={16} sw={1.8} />Imprimir</button>
          <button style={btnGhost}><Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={16} sw={1.8} />PDF</button>
          <button style={{ height: 40, padding: '0 17px', border: 'none', background: '#2563eb', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 16px -6px rgba(37,99,235,.5)', transition: 'background .14s' }}>
            <Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" size={16} sw={1.9} />Editar
          </button>
          <button style={{ width: 40, height: 40, flex: 'none', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
          </button>
        </div>
      </div>

      {/* summary bar */}
      <div style={{ ...card, padding: '20px 26px', display: 'flex', alignItems: 'center', gap: 44, flexWrap: 'wrap', marginBottom: 20 }}>
        <div><div style={{ fontSize: 12, color: 'var(--muted,#64748b)', marginBottom: 7 }}>Estado</div><span style={badgeStyle(op.estado, d)}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{op.estado}</span></div>
        <div><div style={{ fontSize: 12, color: 'var(--muted,#64748b)', marginBottom: 7 }}>Cliente</div><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg,#0f172a)' }}>{op.cliente}</div></div>
        <div><div style={{ fontSize: 12, color: 'var(--muted,#64748b)', marginBottom: 7 }}>Fecha de emisión</div><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg,#0f172a)' }}>{op.emision}</div></div>
        <div><div style={{ fontSize: 12, color: 'var(--muted,#64748b)', marginBottom: 7 }}>Vencimiento</div><div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg,#0f172a)' }}>{op.vencimiento}</div></div>
        <div style={{ textAlign: 'right', marginLeft: 'auto' }}><div style={{ fontSize: 12, color: 'var(--muted,#64748b)', marginBottom: 7 }}>Total</div><div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--fg,#0f172a)' }}>{op.total}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 18 }}>Conceptos</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thCell}>Descripción</th>
                <th style={{ ...thCell, textAlign: 'right' }}>Cant.</th>
                <th style={{ ...thCell, textAlign: 'right' }}>Precio</th>
                <th style={{ ...thCell, textAlign: 'right' }}>Importe</th>
              </tr></thead>
              <tbody>
                {op.conceptos.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border,#e6e8ec)' }}>
                    <td style={{ padding: '15px 0', fontSize: 14, color: 'var(--fg,#0f172a)' }}>{c.desc}</td>
                    <td style={{ padding: '15px 0', textAlign: 'right', fontSize: 14, color: 'var(--fg-2,#334155)' }}>{c.qty}</td>
                    <td style={{ padding: '15px 0', textAlign: 'right', fontSize: 14, color: 'var(--muted,#64748b)' }}>{c.price}</td>
                    <td style={{ padding: '15px 0', textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>{c.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ width: '56%', marginLeft: 'auto', marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0', fontSize: 14 }}><span style={{ color: 'var(--muted,#64748b)' }}>Subtotal</span><span style={{ color: 'var(--fg-2,#334155)', fontWeight: 500 }}>{op.subtotal}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0 13px', fontSize: 14 }}><span style={{ color: 'var(--muted,#64748b)' }}>IVA (16%)</span><span style={{ color: 'var(--fg-2,#334155)', fontWeight: 500 }}>{op.iva}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', borderTop: '1px solid var(--border,#e6e8ec)', fontSize: 15 }}><span style={{ color: 'var(--fg,#0f172a)', fontWeight: 700 }}>Total</span><span style={{ color: 'var(--fg,#0f172a)', fontWeight: 700 }}>{op.totalImp}</span></div>
            </div>
          </div>

          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 8 }}>Documentos relacionados</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {op.docs.map((doc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 0', borderBottom: '1px solid var(--border,#e6e8ec)' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: '#eff4ff', color: '#2563eb' }}>
                    <Icon d={['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5']} size={18} sw={1.8} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg,#0f172a)' }}>{doc.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted,#64748b)', marginTop: 1 }}>{doc.meta}</div>
                  </div>
                  <button style={{ width: 34, height: 34, border: 'none', background: 'transparent', borderRadius: 8, color: 'var(--faint,#94a3b8)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                    <Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={17} sw={1.9} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 18 }}>Datos del cliente</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
              <span style={{ width: 44, height: 44, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', background: '#eff4ff', color: '#2563eb' }}>
                <Icon d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M9 7h.01M9 11h.01M9 15h.01M13 7h.01M13 11h.01M13 15h.01" size={20} sw={1.7} />
              </span>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>{op.cliente}</div><div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)', marginTop: 2 }}>Cliente empresarial</div></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, color: 'var(--fg-2,#334155)' }}><Icon d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6" size={16} sw={1.7} stroke="var(--faint,#94a3b8)" style={{ flex: 'none' }} />{op.email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, color: 'var(--fg-2,#334155)' }}><Icon d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" size={16} sw={1.7} stroke="var(--faint,#94a3b8)" style={{ flex: 'none' }} />{op.phone}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, color: 'var(--fg-2,#334155)' }}><Icon d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" size={16} sw={1.7} stroke="var(--faint,#94a3b8)" style={{ flex: 'none' }} />{op.address}</div>
            </div>
          </div>

          <div style={{ ...card, padding: '22px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 20 }}>Historial</div>
            <div>
              {timeline.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 13 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                    <span style={e.wrap}><Icon d={e.icon} size={16} sw={1.7} /></span>
                    {e.line && <span style={{ width: 2, flex: 1, background: 'var(--border,#e6e8ec)', margin: '6px 0', minHeight: 22 }} />}
                  </div>
                  <div style={{ paddingBottom: 18 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg,#0f172a)' }}>{e.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)', marginTop: 2 }}>{e.sub}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--faint,#94a3b8)', marginTop: 5 }}><Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2" size={12} sw={1.9} />{e.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
