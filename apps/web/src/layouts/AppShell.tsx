import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1000 : false));

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1000) setCollapsed(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar onToggleCollapse={() => setCollapsed((c) => !c)} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '26px 30px 40px' }}>
          <Outlet />
        </main>
        <footer style={{ flex: 'none', padding: '16px 30px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--faint,#94a3b8)', background: 'var(--surface,#fff)', transition: 'background .35s ease' }}>
          <span>© 2026 <b style={{ color: 'var(--muted,#64748b)', fontWeight: 700 }}>Sonovista</b>. Todos los derechos reservados.</span>
          <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>Sonoffice v3.0.0</span>
        </footer>
      </div>
    </div>
  );
}
