import { useTheme } from '../theme/ThemeContext';

function useShim() {
  const { dark } = useTheme();
  return dark
    ? 'linear-gradient(90deg,#141b29,#1c2536,#141b29)'
    : 'linear-gradient(90deg,#eef1f4,#f7f9fb,#eef1f4)';
}

export function SkelBox({ w, h, r = 8 }) {
  const bg = useShim();
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: bg,
        backgroundSize: '200% 100%',
        animation: 'scshim 1.4s infinite',
      }}
    />
  );
}

const card = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
};

export function DashSkeleton() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBottom: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ ...card, padding: 18 }}>
            <SkelBox w={38} h={38} r={11} />
            <div style={{ height: 12 }} />
            <SkelBox w="60%" h={26} />
            <div style={{ height: 8 }} />
            <SkelBox w="40%" h={12} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        <div style={{ ...card, padding: 20 }}>
          <SkelBox w="40%" h={16} />
          <div style={{ height: 16 }} />
          <SkelBox w="100%" h={180} r={12} />
        </div>
        <div style={{ ...card, padding: 20 }}>
          <SkelBox w="50%" h={16} />
          <div style={{ height: 16 }} />
          <SkelBox w="100%" h={180} r={12} />
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div style={{ ...card, padding: '8px 0', overflow: 'hidden' }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <SkelBox w={90} h={14} />
          <SkelBox w="18%" h={14} />
          <SkelBox w="26%" h={14} />
          <SkelBox w={80} h={14} />
          <SkelBox w={70} h={20} r={999} />
          <SkelBox w="10%" h={14} />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div>
      <div style={{ ...card, padding: 22, marginBottom: 16 }}>
        <SkelBox w={120} h={22} />
        <div style={{ height: 12 }} />
        <SkelBox w="50%" h={24} />
        <div style={{ height: 12 }} />
        <SkelBox w="30%" h={14} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16 }}>
        <SkelBox w="100%" h={260} r={16} />
        <SkelBox w="100%" h={260} r={16} />
      </div>
    </div>
  );
}
