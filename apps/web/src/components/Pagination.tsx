import { Icon } from '../lib/icons';

// Reusable numbered pagination bar.
export default function Pagination({ page, totalPages, total, start, end, onPage, label = 'registros' }) {
  const btn = (active) =>
    active
      ? { minWidth: 34, height: 34, padding: '0 8px', borderRadius: 9, border: '1px solid var(--primary,#0f172a)', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'JetBrains Mono,monospace' }
      : { minWidth: 34, height: 34, padding: '0 8px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'JetBrains Mono,monospace' };
  const navBtn = (dis) => ({ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', color: dis ? 'var(--faint,#cbd5e1)' : 'var(--fg-2,#334155)', display: 'grid', placeItems: 'center', cursor: dis ? 'default' : 'pointer', opacity: dis ? 0.55 : 1 });

  return (
    <div style={{ padding: '13px 18px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)' }}>
        Mostrando <b style={{ color: 'var(--fg,#0f172a)' }}>{start}–{end}</b> de <b style={{ color: 'var(--fg,#0f172a)' }}>{total}</b> {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <button onClick={() => onPage(Math.max(1, page - 1))} style={navBtn(page <= 1)}>
          <Icon d="M15 6l-6 6 6 6" size={15} sw={2} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onPage(p)} style={btn(p === page)}>
            {p}
          </button>
        ))}
        <button onClick={() => onPage(Math.min(totalPages, page + 1))} style={navBtn(page >= totalPages)}>
          <Icon d="M9 6l6 6-6 6" size={15} sw={2} />
        </button>
      </div>
    </div>
  );
}
