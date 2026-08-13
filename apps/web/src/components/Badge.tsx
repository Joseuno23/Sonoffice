import { useTheme } from '../theme/ThemeContext';
import { badgeStyle } from '../lib/status';

// Status pill with the leading dot.
export default function Badge({ estado }) {
  const { dark } = useTheme();
  return (
    <span style={badgeStyle(estado, dark)}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {estado}
    </span>
  );
}
