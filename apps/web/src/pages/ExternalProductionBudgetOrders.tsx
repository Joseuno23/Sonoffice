import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { TableSkeleton } from '../components/Skeletons';
import { api } from '../services/api';

export default function ExternalProductionBudgetOrders() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getExternalProductionBudgetOrders().then((res) => setRows(res?.success ? res.data || [] : [])).finally(() => setLoading(false));
  }, []);
  return <div style={{ animation: 'scfade .35s ease' }}>
    <PageHeader crumb="Medios · Presupuestos" title="Órdenes de Producción Externa" sub="Vista de las órdenes relacionadas a presupuestos Externa. Sin creación ni edición desde este submenu." />
    <div style={{ background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      {loading ? <div style={{ padding: 16 }}><TableSkeleton /></div> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['#', 'Fecha', 'Proveedor', 'Observación', 'Impresiones'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 12, fontSize: 11, textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' }}>{h}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td style={{ padding: 12 }}>#{row.id}</td><td style={{ padding: 12 }}>{row.fecha || '—'}</td><td style={{ padding: 12 }}>{row.proveedor || '—'}</td><td style={{ padding: 12 }}>{row.observacion || '—'}</td><td style={{ padding: 12 }}>{row.numImpresiones ?? '—'}</td></tr>)}{!rows.length && <tr><td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Sin órdenes relacionadas.</td></tr>}</tbody></table>}
    </div>
  </div>;
}
