import { useLocation, useNavigate } from 'react-router-dom';
import { I, Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../lib/format';

const NAV = [
  { label: 'Principal', items: [
    { t: 'Panel de control', icon: I.dash, to: '/' },
    { t: 'Buscador', icon: I.search, to: '/buscador' },
  ]},
  { label: 'Operación', items: [
    { t: 'Órdenes de Producción', icon: I.factory, to: '/ordenes', badge: '26' },
    { t: 'Cotizaciones', icon: I.file, to: '/cotizaciones' },
    { t: 'Contratos', icon: I.contract, to: '/contratos' },
    { t: 'Facturación', icon: I.receipt, to: '/facturacion' },
    { t: 'Recepción', icon: I.inbox, to: '/recepcion', badge: '5' },
  ]},
  { label: 'Comercial', items: [
    { t: 'Clientes y Proveedores', icon: I.users, to: '/clientes' },
  ]},
  { label: 'Medios', items: [
    { t: 'Admin de Medios', icon: I.image, to: '/medios' },
    { t: 'Banco de Imágenes', icon: I.image, to: '/imagenes' },
    { t: 'Correspondencia', icon: I.mail, to: '/correspondencia' },
  ]},
  { label: 'Gestión', items: [
    { t: 'Gestión de Calidad', icon: I.shield, to: '/calidad' },
    { t: 'Hojas de Tiempo', icon: I.clock, to: '/tiempos' },
    { t: 'Activos TI', icon: I.server, to: '/activos' },
  ]},
  { label: 'Sistema', items: [
    { t: 'Usuarios y Roles', icon: I.users, to: '/usuarios' },
    { t: 'Sistema General', icon: I.settings, to: '/sistema' },
    { t: 'Helpdesk', icon: I.mail, to: '/helpdesk', badge: '3' },
  ]},
];

export default function Sidebar({ collapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const showLabels = !collapsed;
  const path = location.pathname;

  const isActive = (to) => {
    if (to === '/') return path === '/';
    if (to === '/ordenes') return path.startsWith('/ordenes');
    return path === to || path.startsWith(to + '/');
  };

  const badgeStyle = (active) => ({
    minWidth: 19, height: 19, padding: '0 6px', borderRadius: 9,
    background: active ? 'var(--sb-active-fg)' : 'rgba(148,163,184,.22)',
    color: active ? 'var(--sb-bg)' : 'var(--sb-muted)',
    fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono,monospace',
  });

  return (
    <aside
      style={{
        width: collapsed ? '76px' : '264px',
        flex: 'none',
        background: 'var(--sb-bg)',
        borderRight: '1px solid var(--sb-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh',
        transition: 'width .28s cubic-bezier(.4,0,.2,1),background .35s ease',
        zIndex: 20,
      }}
    >
      <div style={{ height: 60, flex: 'none', display: 'flex', alignItems: 'center', gap: 11, padding: '0 18px', borderBottom: '1px solid var(--sb-border)' }}>
        <img src="/logo.png" alt="Sonoffice" style={{ width: 28, height: 28, flex: 'none' }} />
        {showLabels && (
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', color: 'var(--sb-fg)', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#22d3ee' }}>Son</span>office
          </span>
        )}
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 12px 20px' }}>
        {NAV.map((sec) => (
          <div key={sec.label} style={{ marginBottom: 6 }}>
            {showLabels && (
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--sb-section)', padding: '14px 10px 7px' }}>
                {sec.label}
              </div>
            )}
            {sec.items.map((item) => {
              const active = isActive(item.to);
              return (
                <a
                  key={item.t}
                  href={item.to}
                  title={item.t}
                  onClick={(e) => { e.preventDefault(); navigate(item.to); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 10,
                    textDecoration: 'none', fontSize: 13.5, fontWeight: active ? 600 : 500, marginBottom: 2, position: 'relative',
                    transition: 'background .14s,color .14s',
                    background: active ? 'var(--sb-active-bg)' : 'transparent',
                    color: active ? 'var(--sb-active-fg)' : 'var(--sb-muted)',
                  }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-fg)'; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-muted)'; } }}
                >
                  <span style={{ display: 'flex', flex: 'none' }}>
                    <Icon d={item.icon} size={18} />
                  </span>
                  {showLabels && (
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{item.t}</span>
                  )}
                  {item.badge && showLabels && <span style={badgeStyle(active)}>{item.badge}</span>}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ flex: 'none', padding: 12, borderTop: '1px solid var(--sb-border)' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 11, transition: 'background .14s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sb-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#22d3ee,#0891b2)', color: '#04121a', fontWeight: 800, fontSize: 14, display: 'grid', placeItems: 'center', flex: 'none' }}>
            {initials(user?.name || 'Jose Narvaez')}
          </span>
          {showLabels && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sb-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Jose Narvaez'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--sb-section)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.role || 'Administrador'}</div>
              </div>
              <a
                href="#"
                title="Cerrar sesión"
                onClick={(e) => { e.preventDefault(); logout(); navigate('/login'); }}
                style={{ color: 'var(--sb-section)', display: 'flex', padding: 4 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f43f5e')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sb-section)')}
              >
                <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" size={17} sw={1.9} />
              </a>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
