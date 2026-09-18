import PageHeader from '../components/PageHeader';
import { Icon } from '../lib/icons';

type BudgetSection = 'listar' | 'ordenes';

type BudgetPlaceholderProps = {
  typeLabel: string;
  section: BudgetSection;
};

const card = {
  background: 'var(--surface,#fff)',
  border: '1px solid var(--border,#e5e8ec)',
  borderRadius: 16,
  boxShadow: 'var(--shadow)',
  padding: '56px 24px',
  textAlign: 'center' as const,
};

export default function BudgetPlaceholder({ typeLabel, section }: BudgetPlaceholderProps) {
  const title = section === 'listar' ? `Presupuestos de ${typeLabel}` : `Órdenes de ${typeLabel}`;
  const description = section === 'listar'
    ? 'La navegación del módulo ya está disponible. La consulta y gestión se implementarán en el siguiente slice seguro.'
    : 'La navegación hacia órdenes asociadas ya está disponible. La operación se implementará cuando migre la lógica correspondiente.';

  return (
    <>
      <PageHeader
        crumb={`Medios · Presupuestos · ${typeLabel}`}
        title={title}
        sub="Pantalla placeholder para la migración progresiva de presupuestos."
      />
      <div style={card}>
        <div style={{ width: 72, height: 72, borderRadius: 18, background: 'var(--brand-soft,#ecfeff)', color: 'var(--brand,#0891b2)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
          <Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" size={32} sw={1.7} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg,#0f172a)', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--muted,#64748b)', maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>{description}</div>
      </div>
    </>
  );
}
