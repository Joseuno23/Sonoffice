import PageHeader from './PageHeader';
import { Icon, I } from '../lib/icons';

type QuickAccessDocumentProps = {
  title: string;
  subtitle?: string;
  pdfUrl: string;
  children: React.ReactNode;
};

export default function QuickAccessDocument({ title, subtitle = 'Sonovista Publicidad S.A.', pdfUrl, children }: QuickAccessDocumentProps) {
  return (
    <>
      <PageHeader crumb="Accesos rápidos" title={title} />

      <section style={{ background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden', animation: 'scfade .3s ease' }}>
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--brand-soft,#ecfeff)', color: 'var(--brand,#0891b2)', flex: 'none' }}>
              <Icon d={I.file} size={22} />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: 'var(--fg,#0f172a)' }}>{title}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--muted,#64748b)', fontSize: 13.5 }}>{subtitle}</p>
            </div>
          </div>
          <a href={pdfUrl} download target="_blank" rel="noreferrer" style={{ height: 38, padding: '0 14px', borderRadius: 10, background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
            <Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={16} />
            Descargar PDF
          </a>
        </div>

        <div style={{ padding: 24, color: 'var(--fg-2,#334155)', lineHeight: 1.65, display: 'grid', gap: 20 }}>
          {children}
        </div>
      </section>
    </>
  );
}
