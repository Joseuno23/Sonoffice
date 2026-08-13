import { Icon } from '../lib/icons';

type PageAction = {
  label: string;
  icon?: string;
  onClick: () => void;
};

type PageHeaderProps = {
  crumb: string;
  title: string;
  sub?: string;
  primary?: PageAction;
  secondary?: PageAction;
};

// Page header with breadcrumb, title, optional subtitle and action buttons.
export default function PageHeader({ crumb, title, sub, primary, secondary }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginBottom: 22 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--faint,#94a3b8)', marginBottom: 8 }}>
          <Icon d="M3 11l9-8 9 8M5 10v10h14V10" size={14} sw={1.9} />
          <span>Sonoffice</span>
          <span style={{ color: 'var(--border-strong,#cbd5e1)' }}>/</span>
          <span style={{ color: 'var(--muted,#64748b)', fontWeight: 500 }}>{crumb}</span>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-.02em', margin: 0, color: 'var(--fg,#0f172a)' }}>{title}</h1>
        {sub && <p style={{ margin: '5px 0 0', color: 'var(--muted,#64748b)', fontSize: 14 }}>{sub}</p>}
      </div>
      {(primary || secondary) && (
        <div style={{ display: 'flex', gap: 10 }}>
          {secondary && (
            <button onClick={secondary.onClick} style={{ height: 40, padding: '0 16px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .14s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-3,#f1f3f6)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface,#fff)')}>
              <Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={16} sw={1.9} />
              {secondary.label}
            </button>
          )}
          {primary && (
            <button onClick={primary.onClick} style={{ height: 40, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'filter .14s,transform .1s', boxShadow: '0 5px 14px -6px rgba(15,23,42,.35)' }} onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.08)')} onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}>
              <Icon d={primary.icon || 'M12 5v14M5 12h14'} size={16} sw={2.2} />
              {primary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
