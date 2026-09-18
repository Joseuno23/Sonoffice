import { useEffect, type CSSProperties, type ReactNode } from 'react';

type ToastType = 'success' | 'error';

const baseStyle: CSSProperties = {
  position: 'fixed',
  right: 20,
  bottom: 20,
  zIndex: 80,
  maxWidth: 'min(360px, calc(100vw - 40px))',
  padding: '12px 14px',
  borderRadius: 12,
  boxShadow: 'var(--shadow-lg)',
  fontSize: 13,
  fontWeight: 700,
};

const toneStyle = (type: ToastType): CSSProperties => type === 'error'
  ? {
      color: '#b91c1c',
      background: 'var(--surface,#fff)',
      border: '1px solid rgba(239,68,68,.24)',
    }
  : {
      color: '#047857',
      background: 'var(--surface,#fff)',
      border: '1px solid rgba(16,185,129,.26)',
    };

interface ToastMessageProps {
  type?: ToastType;
  children?: ReactNode;
  message?: ReactNode;
  duration?: number;
  onDismiss?: () => void;
}

export default function ToastMessage({ type = 'success', children, message, duration = 3500, onDismiss }: ToastMessageProps) {
  const content = message ?? children;

  useEffect(() => {
    if (!content || !onDismiss) return;

    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [content, duration, onDismiss]);

  if (!content) return null;

  return (
    <div role="status" aria-live="polite" style={{ ...baseStyle, ...toneStyle(type) }}>
      {content}
    </div>
  );
}
