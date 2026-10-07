import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const input: CSSProperties = { width: '100%', minHeight: 38, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const button: CSSProperties = { minHeight: 38, padding: '0 16px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', fontWeight: 800, cursor: 'pointer' };
const primaryButton: CSSProperties = { ...button, borderColor: 'var(--brand,#0891b2)', background: 'var(--brand,#0891b2)', color: '#fff' };

interface ApproveBulkResult { parsed: number; approved: number; skipped: number; files: number; }

export default function ExpenseOrderApproveBulk() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApproveBulkResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const submit = () => {
    if (!file || loading) return;
    setLoading(true);
    setMessage(null);
    setResult(null);
    api.approveExpenseOrdersBulk(file)
      .then((res) => {
        if (res?.success) {
          setResult(res.data);
          setMessage({ type: 'success', text: res.message || 'Archivo procesado correctamente.' });
        } else {
          setMessage({ type: 'error', text: res?.message || 'No se pudo procesar el archivo.' });
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo procesar el archivo.' }))
      .finally(() => setLoading(false));
  };

  return <>
    <PageHeader crumb="Medios · Órdenes de gastos" title="Aprobar orden" sub="Carga el archivo Excel de órdenes de gastos para aprobación masiva." />
    <div style={card}>
      <div style={{ padding: 20, display: 'grid', gap: 16, maxWidth: 620 }}>
        <label style={{ display: 'grid', gap: 8, fontSize: 13, fontWeight: 800 }}>
          Archivo Excel
          <input type="file" accept=".xls,.xlsx" style={input} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        {message && <div style={{ padding: '11px 14px', borderRadius: 10, color: message.type === 'success' ? '#047857' : '#b91c1c', background: message.type === 'success' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.10)', fontWeight: 700 }}>{message.text}</div>}
        {result && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(100px, 1fr))', gap: 12 }}>
          <Counter label="Parseadas" value={result.parsed} />
          <Counter label="Aprobadas" value={result.approved} />
          <Counter label="Omitidas" value={result.skipped} />
        </div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" style={button} onClick={() => navigate('/medios/ordenes-gastos/listar')}>Volver</button>
          <button type="button" style={primaryButton} disabled={!file || loading} onClick={submit}>{loading ? 'Cargando…' : 'Cargar'}</button>
        </div>
      </div>
    </div>
  </>;
}

function Counter({ label, value }: { label: string; value: number }) {
  return <div style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2,#f7f8fa)' }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted,#64748b)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
    <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900 }}>{value.toLocaleString('es-CO')}</div>
  </div>;
}
