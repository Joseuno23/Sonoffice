import { useState } from 'react';
import { Icon } from '../lib/icons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../lib/format';

const NOTIFS = [
  { title: 'Omar Salas cambió un estado', text: 'OP-2026-1042 → CERRADA', time: 'Hace 8 min', dot: '#10b981' },
  { title: 'Nueva orden asignada', text: 'Rebranding empaques premium', time: 'Hace 40 min', dot: '#38bdf8' },
  { title: 'Aprobación pendiente', text: 'Cotización COT-889 requiere revisión', time: 'Hace 2 h', dot: '#f59e0b' },
];

const iconBtn = {
  width: 38, height: 38, flex: 'none', border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)',
  borderRadius: 10, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'all .14s',
};

export default function Topbar({ onToggleCollapse }) {
  const { dark, toggleDark, toggleSidebarTheme } = useTheme();
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);

  const hover = (e, on) => {
    e.currentTarget.style.borderColor = on ? 'var(--border-strong,#d5d9e0)' : 'var(--border,#e5e8ec)';
    e.currentTarget.style.color = on ? 'var(--fg,#0f172a)' : 'var(--muted,#64748b)';
  };

  return (
    <header style={{ height: 60, flex: 'none', position: 'sticky', top: 0, zIndex: 15, background: 'var(--surface,#fff)', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', transition: 'background .35s ease,border-color .35s ease' }}>
      <button onClick={onToggleCollapse} title="Menú" style={{ width: 38, height: 38, flex: 'none', border: 'none', background: 'transparent', borderRadius: 10, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'grid', placeItems: 'center', transition: 'background .14s' }}>
        <Icon d="M3 6h18M3 12h18M3 18h18" size={19} sw={2} />
      </button>

      <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}>
          <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5" size={16} sw={2} />
        </span>
        <input
          placeholder="Buscar órdenes, clientes, documentos…"
          style={{ width: '100%', height: 40, padding: '0 14px 0 38px', borderRadius: 10, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13.5, outline: 'none', transition: 'border-color .15s,box-shadow .15s' }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--brand,#0891b2)'; e.target.style.boxShadow = '0 0 0 3px var(--brand-soft,#ecfeff)'; }}
          onBlur={(e) => { e.target.style.borderColor = 'var(--border,#e5e8ec)'; e.target.style.boxShadow = 'none'; }}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontFamily: 'JetBrains Mono,monospace', color: 'var(--faint,#94a3b8)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 6, padding: '2px 6px' }}>⌘K</span>
      </div>

      <div style={{ flex: 1 }} />

      <button onClick={toggleSidebarTheme} title="Cambiar estilo del sidebar" style={{ height: 36, padding: '0 12px', flex: 'none', border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', borderRadius: 9, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, transition: 'all .14s' }} onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
        <Icon d="M4 4h6v16H4zM10 4h10v16H10z" size={15} sw={1.9} />
        Sidebar
      </button>

      <button onClick={toggleDark} title="Modo claro / oscuro" style={iconBtn} onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
        <Icon d={dark ? 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4' : 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8'} size={17} />
      </button>

      <div style={{ position: 'relative' }}>
        <button onClick={() => setNotifOpen((o) => !o)} title="Notificaciones" style={{ ...iconBtn, position: 'relative' }} onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}>
          <Icon d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" size={17} />
          <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, background: '#f43f5e', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', border: '2px solid var(--surface,#fff)' }}>8</span>
        </button>
        {notifOpen && (
          <div style={{ position: 'absolute', right: 0, top: 46, width: 340, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 14, boxShadow: 'var(--shadow-lg,0 20px 40px -12px rgba(15,23,42,.2))', overflow: 'hidden', zIndex: 40, animation: 'scpop .18s ease' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Notificaciones</span>
              <span style={{ fontSize: 12, color: 'var(--brand,#0891b2)', fontWeight: 600, cursor: 'pointer' }}>Marcar leídas</span>
            </div>
            {NOTIFS.map((n, i) => (
              <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', gap: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flex: 'none', background: n.dot }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg,#0f172a)' }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)', marginTop: 2 }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--faint,#94a3b8)', marginTop: 4, fontFamily: 'JetBrains Mono,monospace' }}>{n.time}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '11px 16px', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--brand,#0891b2)', cursor: 'pointer' }}>Ver todas</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 10px 4px 4px', border: '1px solid var(--border,#e5e8ec)', borderRadius: 11, cursor: 'pointer', transition: 'all .14s' }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#22d3ee,#0891b2)', color: '#04121a', fontWeight: 800, fontSize: 12, display: 'grid', placeItems: 'center' }}>{initials(user?.name || 'Jose Narvaez')}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg,#0f172a)' }}>{user?.name || 'Jose Narvaez'}</span>
        <Icon d="M6 9l6 6 6-6" size={14} sw={2} stroke="var(--faint,#94a3b8)" />
      </div>
    </header>
  );
}
