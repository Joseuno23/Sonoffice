import { useTheme } from '../../theme/ThemeContext';

// Area/line chart — ported from the prototype's chartArea().
export default function AreaChart() {
  const { dark: d } = useTheme();
  const data = [12, 18, 15, 22, 19, 26, 24, 31];
  const labels = ['Nov', 'Dic', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
  const W = 580, H = 210, pl = 34, pr = 12, pt = 16, pb = 28;
  const iw = W - pl - pr, ih = H - pt - pb, max = 35;
  const x = (i) => pl + iw * (i / (data.length - 1));
  const y = (v) => pt + ih * (1 - v / max);
  const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = line + ` L${x(data.length - 1).toFixed(1)} ${pt + ih} L${x(0).toFixed(1)} ${pt + ih} Z`;
  const brand = d ? '#22d3ee' : '#0891b2';
  const grid = [0, 7, 14, 21, 28, 35];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', marginTop: 6 }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={brand} stopOpacity={0.28} />
          <stop offset="100%" stopColor={brand} stopOpacity={0} />
        </linearGradient>
      </defs>
      {grid.map((g, i) => (
        <g key={'g' + i}>
          <line x1={pl} x2={W - pr} y1={y(g)} y2={y(g)} stroke={d ? 'rgba(255,255,255,.06)' : '#eef1f4'} strokeWidth={1} />
          <text x={pl - 7} y={y(g) + 3} textAnchor="end" fontSize={9.5} fill={d ? '#5f6b7e' : '#b4bdc9'} fontFamily="JetBrains Mono,monospace">
            {g}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#ag)" />
      <path d={line} fill="none" stroke={brand} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={'c' + i} cx={x(i)} cy={y(v)} r={3.4} fill={d ? '#111725' : '#fff'} stroke={brand} strokeWidth={2} />
      ))}
      {labels.map((l, i) => (
        <text key={'l' + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10.5} fill={d ? '#8b98ab' : '#94a3b8'} fontFamily="Inter,sans-serif">
          {l}
        </text>
      ))}
    </svg>
  );
}
