import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import PageHeader from '../components/PageHeader';

export default function ComingSoon() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader crumb="Sistema" title="Módulo" />
      <div style={{ background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', padding: '80px 24px', textAlign: 'center', animation: 'scfade .3s ease' }}>
        <div style={{ width: 76, height: 76, borderRadius: 20, background: 'var(--brand-soft,#ecfeff)', display: 'grid', placeItems: 'center', margin: '0 auto 20px', color: 'var(--brand,#0891b2)' }}>
          <Icon d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM8 12l3 3 5-5" size={34} sw={1.6} />
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--fg,#0f172a)', marginBottom: 8, letterSpacing: '-.01em' }}>Módulo en construcción</div>
        <div style={{ fontSize: 14, color: 'var(--muted,#64748b)', maxWidth: 380, margin: '0 auto 22px', lineHeight: 1.6 }}>Esta sección forma parte del roadmap de migración. Explora el Panel de control y el módulo de Órdenes de Producción, ya disponibles en esta demo.</div>
        <button onClick={() => navigate('/')} style={{ height: 40, padding: '0 20px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')} onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}>Ir al Panel de control</button>
      </div>
    </>
  );
}
