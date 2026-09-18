import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '../lib/icons';

type ConfirmTone = 'default' | 'danger' | 'warning';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const toneStyles: Record<ConfirmTone, { color: string; bg: string; border: string; icon: string }> = {
  default: {
    color: 'var(--brand,#0891b2)',
    bg: 'rgba(8,145,178,.10)',
    border: 'rgba(8,145,178,.18)',
    icon: 'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  },
  danger: {
    color: '#dc2626',
    bg: 'rgba(239,68,68,.10)',
    border: 'rgba(239,68,68,.20)',
    icon: 'M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z',
  },
  warning: {
    color: 'var(--primary,#0f172a)',
    bg: 'rgba(15,23,42,.06)',
    border: 'var(--border,#e5e8ec)',
    icon: 'M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0z',
  },
};

const buttonBase: CSSProperties = { height: 40, padding: '0 16px', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer' };

export default function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancelar', tone = 'default', loading = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const loadingRef = useRef(loading);
  const onCancelRef = useRef(onCancel);
  const toneStyle = toneStyles[tone];

  useEffect(() => {
    loadingRef.current = loading;
    onCancelRef.current = onCancel;
  }, [loading, onCancel]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loadingRef.current) onCancelRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onMouseDown={() => { if (!loading) onCancel(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'scfade .18s ease' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ width: 'min(460px, 100%)', overflow: 'hidden', borderRadius: 18, border: '1px solid var(--border,#e5e8ec)', background: 'linear-gradient(180deg,var(--surface,#fff),var(--surface,#fff) 72%,var(--surface-2,#f7f8fa))', boxShadow: 'var(--shadow-lg,0 24px 70px -18px rgba(15,23,42,.38))', animation: 'scpop .18s cubic-bezier(.2,.7,.3,1)' }}
      >
        <div style={{ padding: '22px 22px 18px', display: 'flex', gap: 15, alignItems: 'flex-start' }}>
          <div style={{ width: 46, height: 46, flex: 'none', borderRadius: 15, display: 'grid', placeItems: 'center', color: toneStyle.color, background: toneStyle.bg, border: `1px solid ${toneStyle.border}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45)' }}>
            <Icon d={toneStyle.icon} size={22} sw={1.9} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div id="confirm-dialog-title" style={{ color: 'var(--fg,#0f172a)', fontSize: 18, fontWeight: 850, letterSpacing: '-.02em', lineHeight: 1.2 }}>{title}</div>
            <div id="confirm-dialog-description" style={{ color: 'var(--muted,#64748b)', fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}>{description}</div>
          </div>
        </div>
        <div style={{ padding: '15px 18px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'rgba(15,23,42,.025)' }}>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={loading} style={{ ...buttonBase, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', cursor: loading ? 'default' : 'pointer', opacity: loading ? .65 : 1 }}>{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={loading} style={{ ...buttonBase, border: 'none', background: tone === 'danger' ? '#dc2626' : 'var(--primary,#0f172a)', color: tone === 'danger' ? '#fff' : 'var(--primary-fg,#fff)', cursor: loading ? 'wait' : 'pointer', opacity: loading ? .78 : 1 }}>{loading ? 'Procesando...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
