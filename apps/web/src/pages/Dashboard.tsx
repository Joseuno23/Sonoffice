import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { I, Icon } from '../lib/icons';
import { useTheme } from '../theme/ThemeContext';
import { badgeStyle } from '../lib/status';
import PageHeader from '../components/PageHeader';
import AreaChart from '../components/charts/AreaChart';
import DonutChart from '../components/charts/DonutChart';
import { DashSkeleton } from '../components/Skeletons';
import { api } from '../services/api';

const card = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)' };
const KPI_ICONS = { factory: I.factory, clock: I.clock, shield: I.shield, money: I.money };
const KPI_WRAP = {
  factory: (d) => ({ background: d ? 'rgba(34,211,238,.14)' : '#ecfeff', color: d ? '#22d3ee' : '#0891b2' }),
  clock: (d) => ({ background: d ? 'rgba(56,189,248,.14)' : '#e0f2fe', color: d ? '#7dd3fc' : '#0369a1' }),
  shield: (d) => ({ background: d ? 'rgba(16,185,129,.14)' : '#d1fae5', color: d ? '#6ee7b7' : '#047857' }),
  money: (d) => ({ background: d ? 'rgba(148,163,184,.14)' : '#f1f3f6', color: d ? '#cbd5e1' : '#475569' }),
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { dark: d } = useTheme();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState([]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getDashboard()
      .then((data) => { if (live) setKpis(data.kpis); })
      .catch(() => { if (live) setKpis([
        { key: 'factory', value: '18', label: 'Órdenes activas', trend: '+3', up: true },
        { key: 'clock', value: '24', label: 'En proceso', trend: '+5', up: true },
        { key: 'shield', value: '42', label: 'Cerradas este mes', trend: '+12', up: true },
        { key: 'money', value: '$128M', label: 'Facturación del mes', trend: '-2%', up: false },
      ]); })
      .finally(() => { if (live) setTimeout(() => setLoading(false), 500); });
    return () => { live = false; };
  }, []);

  const trBase = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '3px 8px', borderRadius: 7, fontFamily: 'Inter' };
  const trUp = { color: '#047857', background: 'rgba(16,185,129,.12)' };
  const trDown = { color: '#b45309', background: 'rgba(245,158,11,.14)' };
  const av = (bg, fg) => ({ background: bg, color: fg });

  const activity = [
    { initials: 'OS', who: 'Omar Salas', action: 'cerró la orden', ref: 'Diseño y producción · POP Carnes Frías 2026', tag: 'Cerrada', time: '8 min', avatarStyle: av(d ? 'rgba(148,163,184,.18)' : '#e2e8f0', d ? '#cbd5e1' : '#475569'), estado: 'Cerrado' },
    { initials: 'LM', who: 'Laura Méndez', action: 'aprobó la tarea', ref: 'Rebranding empaques premium', tag: 'Aprobada', time: '34 min', avatarStyle: av(d ? 'rgba(16,185,129,.18)' : '#d1fae5', d ? '#6ee7b7' : '#047857'), estado: 'Activo' },
    { initials: 'AG', who: 'Andrea Gómez', action: 'creó la orden', ref: 'Campaña temporada navideña', tag: 'En proceso', time: '1 h', avatarStyle: av(d ? 'rgba(56,189,248,.18)' : '#e0f2fe', d ? '#7dd3fc' : '#0369a1'), estado: 'En proceso' },
    { initials: 'DT', who: 'Diego Torres', action: 'adjuntó un documento', ref: 'Catálogo institucional 2026', tag: 'Pendiente', time: '3 h', avatarStyle: av(d ? 'rgba(245,158,11,.18)' : '#fef3c7', d ? '#fcd34d' : '#b45309'), estado: 'Pendiente' },
  ];
  const pendientes = [
    { title: 'Aprobar cotización COT-889', meta: 'Vence hoy · Grupo Éxito', dot: '#f43f5e' },
    { title: 'Revisar arte final OP-1039', meta: 'Mañana · Postobón', dot: '#f59e0b' },
    { title: 'Cargar factura FE-2261', meta: 'En 2 días · Alpina', dot: '#38bdf8' },
  ];
  const quick = [
    { label: 'Nueva OP', icon: I.factory, to: '/ordenes/nueva' },
    { label: 'Cotización', icon: I.file, to: '/cotizaciones' },
    { label: 'Factura', icon: I.receipt, to: '/facturacion' },
    { label: 'Cliente', icon: I.users, to: '/clientes' },
    { label: 'Recepción', icon: I.inbox, to: '/recepcion' },
    { label: 'Reportes', icon: I.trend, to: '/sistema' },
  ];

  return (
    <>
      <PageHeader crumb="Indicadores" title="Panel de control" sub="Resumen de tu operación al día de hoy." />
      {loading ? (
        <DashSkeleton />
      ) : (
        <div style={{ animation: 'scfade .4s ease' }}>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBottom: 20 }}>
            {kpis.map((k) => (
              <div key={k.key} style={{ ...card, padding: '18px 18px 16px', transition: 'transform .16s,box-shadow .16s' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', ...KPI_WRAP[k.key](d) }}>
                    <Icon d={KPI_ICONS[k.key]} size={19} sw={1.9} />
                  </span>
                  <span style={{ ...trBase, ...(k.up ? trUp : trDown) }}>
                    <Icon d={k.up ? I.trend : I.trendDown} size={12} sw={2.4} />
                    {k.trend}
                  </span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--fg,#0f172a)' }}>{k.value}</div>
                <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ ...card, padding: 20, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Órdenes de producción</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)' }}>Últimos 8 meses</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand,#0891b2)', background: 'var(--brand-soft,#ecfeff)', padding: '5px 10px', borderRadius: 8 }}>+18.4%</span>
              </div>
              <AreaChart />
            </div>
            <div style={{ ...card, padding: 20, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 2 }}>Distribución por estado</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)', marginBottom: 14 }}>Total del periodo</div>
              <DonutChart />
            </div>
          </div>

          {/* bottom row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>Actividad reciente</span>
                <a href="/ordenes" onClick={(e) => { e.preventDefault(); navigate('/ordenes'); }} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand,#0891b2)', textDecoration: 'none' }}>Ver todo</a>
              </div>
              <div>
                {activity.map((a, i) => (
                  <div key={i} style={{ padding: '13px 20px', display: 'flex', gap: 13, alignItems: 'flex-start', borderBottom: '1px solid var(--border,#e5e8ec)' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', fontSize: 11.5, fontWeight: 700, ...a.avatarStyle }}>{a.initials}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--fg,#0f172a)' }}><b style={{ fontWeight: 700 }}>{a.who}</b> {a.action}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.ref}</div>
                    </div>
                    <div style={{ textAlign: 'right', flex: 'none' }}>
                      <span style={badgeStyle(a.estado, d)}>{a.tag}</span>
                      <div style={{ fontSize: 11, color: 'var(--faint,#94a3b8)', marginTop: 5, fontFamily: 'JetBrains Mono,monospace' }}>{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border,#e5e8ec)', fontSize: 15, fontWeight: 700, color: 'var(--fg,#0f172a)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#f59e0b', display: 'flex' }}>
                    <Icon d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" size={17} sw={1.9} />
                  </span>
                  Pendientes
                </div>
                {pendientes.map((p, i) => (
                  <div key={i} style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 11, borderBottom: '1px solid var(--border,#e5e8ec)', cursor: 'pointer' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: p.dot }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg,#0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted,#64748b)' }}>{p.meta}</div>
                    </div>
                    <Icon d="M9 6l6 6-6 6" size={16} sw={2} stroke="var(--faint,#94a3b8)" />
                  </div>
                ))}
              </div>
              <div style={{ ...card, padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 14 }}>Accesos rápidos</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {quick.map((q) => (
                    <a key={q.label} href={q.to} onClick={(e) => { e.preventDefault(); navigate(q.to); }} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '14px 6px', borderRadius: 12, border: '1px solid var(--border,#e5e8ec)', transition: 'all .14s' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--brand,#0891b2)'; e.currentTarget.style.background = 'var(--brand-soft,#ecfeff)'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border,#e5e8ec)'; e.currentTarget.style.background = 'transparent'; }}>
                      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-3,#f1f3f6)', color: 'var(--fg-2,#334155)', display: 'grid', placeItems: 'center' }}>
                        <Icon d={q.icon} size={17} sw={1.85} />
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-2,#334155)', textAlign: 'center', lineHeight: 1.25 }}>{q.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
