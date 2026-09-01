import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

export type AlertMessageType = 'success' | 'error';

const baseStyle: CSSProperties = {
  marginBottom: 14,
  padding: '11px 14px',
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
};

const toneStyle = (type: AlertMessageType): CSSProperties => type === 'error'
  ? {
      color: '#b91c1c',
      background: 'rgba(239,68,68,.10)',
      border: '1px solid rgba(239,68,68,.18)',
    }
  : {
      color: '#047857',
      background: 'rgba(16,185,129,.12)',
      border: '1px solid rgba(16,185,129,.18)',
    };

export function useAutoScrollMessage<T extends HTMLElement>(messageKey: unknown) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!messageKey || !ref.current) return;

    const frame = window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messageKey]);

  return ref;
}

interface AlertMessageProps {
  type?: AlertMessageType;
  children?: ReactNode;
  message?: ReactNode;
  style?: CSSProperties;
  autoScrollKey?: unknown;
}

export default function AlertMessage({ type = 'error', children, message, style, autoScrollKey }: AlertMessageProps) {
  const content = message ?? children;
  const ref = useAutoScrollMessage<HTMLDivElement>(autoScrollKey ?? content);

  if (!content) return null;

  return (
    <div ref={ref} role="alert" aria-live="assertive" style={{ ...baseStyle, ...toneStyle(type), ...style }}>
      {content}
    </div>
  );
}
