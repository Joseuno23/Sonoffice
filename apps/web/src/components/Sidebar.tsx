import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { I, Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../lib/format';
import { api, assetUrl } from '../services/api';

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
    { t: 'Mesa de ayuda', icon: I.mail, to: '/helpdesk' },
  ]},
  { label: 'Sistema', items: [
    { t: 'Usuarios y Roles', icon: I.users, to: '/usuarios' },
    { t: 'Roles del sistema', icon: I.roles, to: '/system/roles' },
    { t: 'Sistema General', icon: I.settings, to: '/sistema' },
  ]},
];

const QUICK_ACCESS_SECTION = {
  label: 'Accesos rápidos',
  items: [
    {
      t: 'Cod. Ética y Conducta',
      icon: I.file,
      to: '/accesos-rapidos/codigo-etica-conducta',
    },
    {
      t: 'Políticas del SIG.',
      icon: I.file,
      to: '/accesos-rapidos/politicas-sig',
    },
    {
      t: 'Alcance del SIG.',
      icon: I.file,
      to: '/accesos-rapidos/alcance-sig',
    },
    {
      t: 'Reglamento Interno.',
      icon: I.file,
      to: '/accesos-rapidos/reglamento-interno',
    },
  ],
};

const iconFor = (name) => I[name] || I.settings;

const userAvatarUrl = (user) => {
  if (user?.avatarUrl) return assetUrl(user.avatarUrl);
  if (user?.avatar && /^[A-Za-z0-9._-]+$/.test(user.avatar)) return assetUrl(`/uploads/avatars/${encodeURIComponent(user.avatar)}`);
  return null;
};

function UserAvatar({ user, size = 36, radius = 10 }) {
  const src = userAvatarUrl(user);
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [src]);

  return (
    <span style={{ width: size, height: size, borderRadius: radius, background: 'linear-gradient(135deg,#22d3ee,#0891b2)', color: '#04121a', fontWeight: 800, fontSize: size > 34 ? 14 : 12, display: 'grid', placeItems: 'center', flex: 'none', overflow: 'hidden' }}>
      {src && !broken ? <img src={src} alt={`Avatar de ${user?.name || 'usuario'}`} onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(user?.name || 'Jose Narvaez')}
    </span>
  );
}

const toSections = (menuItems) => menuItems.map((item) => ({
  label: item.label,
  items: item.route ? [item] : item.children || [],
})).filter((section) => section.items.length > 0);

const hasActiveChild = (children, isActive) => children.some((child) => (
  child.route ? isActive(child.route) : hasActiveChild(child.children || [], isActive)
));

export default function Sidebar({ collapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dynamicMenu, setDynamicMenu] = useState(null);
  const [menuLoadFailed, setMenuLoadFailed] = useState(false);
  const showLabels = !collapsed;
  const path = location.pathname;

  useEffect(() => {
    if (!user) {
      setDynamicMenu(null);
      setMenuLoadFailed(false);
      return;
    }

    let active = true;
    setDynamicMenu(null);
    setMenuLoadFailed(false);

    api.getMenus()
      .then((response) => {
        if (!active) return;
        setDynamicMenu(response?.success && Array.isArray(response.data) ? response.data : null);
        setMenuLoadFailed(false);
      })
      .catch(() => {
        if (!active) return;
        setDynamicMenu(null);
        setMenuLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const menuSections = user?.roleId && !menuLoadFailed ? toSections(dynamicMenu || []) : NAV;
  const sections = [
    ...menuSections,
    QUICK_ACCESS_SECTION,
  ];

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

  const renderMenuItem = (item, level = 0) => {
    const to = item.to || item.route;
    const label = item.t || item.label;
    const children = item.children || [];
    const active = to ? isActive(to) : hasActiveChild(children, isActive);
    const icon = item.t ? item.icon : iconFor(item.icon);
    const paddingLeft = 10 + level * 14;

    return (
      <div key={item.code || item.t || item.id}>
        <a
          href={to || '#'}
          title={label}
          onClick={(e) => {
            e.preventDefault();
            if (to) navigate(to);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: `9px 10px 9px ${paddingLeft}px`, borderRadius: 10,
            textDecoration: 'none', fontSize: 13.5, fontWeight: active ? 600 : 500, marginBottom: 2, position: 'relative',
            transition: 'background .14s,color .14s', cursor: to ? 'pointer' : 'default',
            background: active ? 'var(--sb-active-bg)' : 'transparent',
            color: active ? 'var(--sb-active-fg)' : 'var(--sb-muted)',
          }}
          onMouseEnter={(e) => { if (!active && to) { e.currentTarget.style.background = 'var(--sb-hover)'; e.currentTarget.style.color = 'var(--sb-fg)'; } }}
          onMouseLeave={(e) => { if (!active && to) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--sb-muted)'; } }}
        >
          {level === 0 && (
            <span style={{ display: 'flex', flex: 'none' }}>
              <Icon d={icon} size={18} />
            </span>
          )}
          {level > 0 && showLabels && <span style={{ width: 18, flex: 'none' }} />}
          {showLabels && (
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{label}</span>
          )}
          {item.badge && showLabels && <span style={badgeStyle(active)}>{item.badge}</span>}
        </a>
        {showLabels && children.map((child) => renderMenuItem(child, level + 1))}
      </div>
    );
  };

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
        {sections.map((sec) => (
          <div key={sec.label} style={{ marginBottom: 6 }}>
            {showLabels && (
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase', color: 'var(--sb-section)', padding: '14px 10px 7px' }}>
                {sec.label}
              </div>
            )}
            {sec.items.map((item) => renderMenuItem(item))}
          </div>
        ))}
      </nav>

      <div style={{ flex: 'none', padding: 12, borderTop: '1px solid var(--sb-border)' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 11, transition: 'background .14s' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sb-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <UserAvatar user={user} />
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
