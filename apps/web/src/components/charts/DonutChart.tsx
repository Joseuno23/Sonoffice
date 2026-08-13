import { useTheme } from '../../theme/ThemeContext';

// Donut chart — ported from the prototype's chartDonut().
export default function DonutChart() {
  const { dark: d } = useTheme();
  const segs = [
    ['Activo', 18, '#10b981'],
    ['En proceso', 24, '#38bdf8'],
    ['Pendiente', 9, '#f59e0b'],
    ['Cerrado', 42, '#94a3b8'],
    ['Anulado', 5, '#f43f5e'],
  ] as const;
  const total = segs.reduce((a, s) => a + s[1], 0);
  const r = 52, C = 2 * Math.PI * r, cx = 70, cy = 70;
  let off = 0;
  const circles = segs.map((s, i) => {
    const len = C * (s[1] / total);
    const el = (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={s[2]}
        strokeWidth={17}
        strokeDasharray={`${len} ${C - len}`}
        strokeDashoffset={-off}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    );
    off += len;
    return el;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 140 140" width={140} height={140} style={{ flex: 'none' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={d ? 'rgba(255,255,255,.06)' : '#f1f3f6'} strokeWidth={17} />
        {circles}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={27} fontWeight={800} fill={d ? '#e8ecf3' : '#0f172a'} fontFamily="Inter">
          {total}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10.5} fill={d ? '#8b98ab' : '#94a3b8'} fontFamily="Inter">
          Órdenes
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 130 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s[2], flex: 'none' }} />
            <span style={{ color: d ? '#c2cbd8' : '#334155', fontWeight: 500, flex: 1 }}>{s[0]}</span>
            <span style={{ color: d ? '#8b98ab' : '#64748b', fontFamily: 'JetBrains Mono,monospace', fontWeight: 600 }}>{s[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
