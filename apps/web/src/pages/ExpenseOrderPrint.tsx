import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fmtMoneyFull } from '../lib/format';
import { api } from '../services/api';

interface PrintData {
  order: { id: number; fecha: string | null; estado: string | null; copyLabel: string; observacion: string | null; aprobada: boolean };
  provider: { name: string | null; nit: string | null };
  service: string | null;
  user: string | null;
  details: { idDetalle: number; detalle: string; cantidad: number; valor: number }[];
  totals: { valor: number; descuento: number; subtotal: number; iva: number; total: number; porcDescuento: number; porcIva: number };
}

const page: CSSProperties = { minHeight: '100vh', background: 'var(--bg,#f3f5f8)', padding: '24px 16px 40px', color: 'var(--fg,#0f172a)' };
const sheet: CSSProperties = { width: 'min(980px, 100%)', margin: '0 auto', background: '#fff', border: '1px solid var(--border,#e5e8ec)', borderRadius: 18, boxShadow: '0 18px 45px rgba(15,23,42,.10)', overflow: 'hidden' };
const section: CSSProperties = { padding: '18px 24px', borderTop: '1px solid var(--border,#e5e8ec)' };
const label: CSSProperties = { fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--muted,#64748b)' };
const th: CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const td: CSSProperties = { padding: '11px 12px', fontSize: 12.5, color: 'var(--fg-2,#334155)', borderBottom: '1px solid var(--border,#e5e8ec)', verticalAlign: 'top' };

function formatDate(value: string | null) {
  return value ? new Date(value + 'T00:00:00').toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: '2-digit' }) : 'Sin fecha';
}

function fileSafe(value: string | number | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sin-nombre';
}

function CompactRow({ label: rowLabel, value: rowValue }: { label: string; value: string | number | null | undefined }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '92px minmax(0, 1fr)', gap: 8, alignItems: 'baseline', minWidth: 0 }}><div style={{ fontSize: 9.2, letterSpacing: '.035em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', fontWeight: 800, whiteSpace: 'nowrap' }}>{rowLabel}</div><div style={{ fontSize: 10.8, color: 'var(--fg,#0f172a)', fontWeight: 100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rowValue || '—'}</div></div>;
}

export default function ExpenseOrderPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoPrintStarted = useRef(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api.getExpenseOrderPrintData(id)
      .then((res) => {
        if (!live) return;
        if (res?.success) setData(res.data);
        else setError(res?.message || 'No se pudo cargar la orden de gastos');
      })
      .catch(() => { if (live) setError('No se pudo cargar la orden de gastos'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  const runPrint = async () => {
    if (!id || printing) return;
    setPrinting(true);
    setError(null);
    try {
      const res = await api.printExpenseOrder(id);
      if (!res?.success) {
        setError(res?.message || 'No se pudo marcar la orden como impresa');
        return;
      }
      window.print();
    } catch {
      setError('No se pudo marcar la orden como impresa');
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (!data || params.get('autoprint') !== '1' || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    window.setTimeout(() => { void runPrint(); }, 150);
  }, [data, params]);

  useEffect(() => {
    if (!data) return;
    const previousTitle = document.title;
    document.title = `OG_${fileSafe(data.order.id)}_${fileSafe(data.provider.name)}`;
    return () => { document.title = previousTitle; };
  }, [data]);

  return (
    <div style={page} className="expense-order-print-page">
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        .expense-order-print-page, .expense-order-print-page * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .expense-order-print-keep {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .expense-order-print-details tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .expense-order-print-details thead {
          display: table-header-group;
        }
        @media print {
          html, body, #root { background: #fff !important; }
          .expense-order-print-page { padding: 0 !important; background: #fff !important; }
          .expense-order-print-toolbar { display: none !important; }
          .expense-order-print-sheet { width: 100% !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
          .expense-order-print-header { background: linear-gradient(135deg, #e6f7fb, #f8fafc) !important; border: 1px solid #dbeafe !important; border-radius: 14px !important; margin-bottom: 10px !important; }
          .expense-order-print-section { border-top-color: #e2e8f0 !important; }
          .expense-order-print-grid { break-inside: avoid; page-break-inside: avoid; }
        }
        @media (max-width: 720px) {
          .expense-order-print-grid { grid-template-columns: 1fr !important; }
          .expense-order-print-header { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      <div className="expense-order-print-toolbar" style={{ width: 'min(980px, 100%)', margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--muted,#64748b)' }}>Vista de impresión de orden de gastos</div>
        <button onClick={runPrint} disabled={!data || printing} style={{ height: 40, padding: '0 18px', border: 'none', borderRadius: 11, background: 'var(--brand,#0891b2)', color: '#fff', fontWeight: 800, cursor: !data || printing ? 'default' : 'pointer', opacity: !data || printing ? .6 : 1 }}>
          {printing ? 'Preparando...' : 'Imprimir'}
        </button>
      </div>

      <div className="expense-order-print-sheet" style={sheet}>
        {loading ? (
          <div style={{ padding: 42, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Cargando orden...</div>
        ) : error ? (
          <div style={{ padding: 42, textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>{error}</div>
        ) : data ? (
          <>
            <div className="expense-order-print-header expense-order-print-keep" style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, background: 'linear-gradient(135deg, rgba(8,145,178,.10), rgba(15,23,42,.02))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src="/logo.png" alt="Sonoffice" style={{ width: 46, height: 46 }} />
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-.02em' }}>SONOVISTA PUBLICIDAD S.A.</div>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--muted,#64748b)' }}>{data.order.copyLabel} · {data.order.estado || 'Sin estado'}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 32, fontWeight: 950 }}>OG#{data.order.id}</div></div>
            </div>

            <div style={{ ...section, paddingTop: 13, paddingBottom: 13 }} className="expense-order-print-section expense-order-print-keep">
              <div style={{ ...label, marginBottom: 8, textAlign: 'center' }}>Orden de gasto</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', columnGap: 26, rowGap: 6 }} className="expense-order-print-grid">
                <CompactRow label="Fecha" value={formatDate(data.order.fecha)} />
                <CompactRow label="Proveedor" value={data.provider.name} />
                <CompactRow label="NIT" value={data.provider.nit} />
                <CompactRow label="Servicio" value={data.service?.toUpperCase()} />
                <CompactRow label="Elaboró" value={data.user} />
              </div>
            </div>

            <div style={section} className="expense-order-print-section">
              <div style={{ ...label, marginBottom: 10, textAlign: 'center' }}>Detalles del servicio</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="expense-order-print-details" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead><tr><th style={{ ...th, width: '72%' }}>Descripción</th><th style={{ ...th, width: '28%', textAlign: 'right' }}>Valor</th></tr></thead>
                  <tbody>
                    {data.details.map((detail) => (
                      <tr key={detail.idDetalle}>
                        <td style={{ ...td, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail.detalle}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: 'var(--fg,#0f172a)', whiteSpace: 'nowrap' }}>{fmtMoneyFull(detail.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...section, display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 14, paddingTop: 14, paddingBottom: 14 }} className="expense-order-print-section expense-order-print-grid expense-order-print-keep">
              <div>
                <div style={label}>Observación</div>
                <div style={{ marginTop: 6, minHeight: 38, padding: 10, border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, fontSize: 11.5, color: 'var(--fg-2,#334155)', whiteSpace: 'pre-wrap' }}>{data.order.observacion?.trim() || 'Sin observaciones'}</div>
                <div style={{ ...label, marginTop: 12 }}>Nota</div>
                <div style={{ marginTop: 6, padding: 10, border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, fontSize: 11.5, color: 'var(--fg-2,#334155)' }}>Favor elaborar su factura a nombre de Sonovista Publicidad S.A. (NIT 890.101.778-4) y enviarla al correo electrónico: facturacion@sonovista.co.</div>
              </div>
              <div style={{ border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, padding: 11, alignSelf: 'start' }}>
                {[
                  ['Valor', data.totals.valor],
                  [`Descuento (${data.totals.porcDescuento}%)`, -data.totals.descuento],
                  ['Subtotal', data.totals.subtotal],
                  [`IVA (${data.totals.porcIva}%)`, data.totals.iva],
                ].map(([name, amount]) => (
                  <div key={String(name)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontSize: 11.5, color: 'var(--fg-2,#334155)' }}><span>{name}</span><b>{fmtMoneyFull(Number(amount))}</b></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border,#e5e8ec)', fontSize: 14, fontWeight: 900 }}><span>Total</span><span>{fmtMoneyFull(data.totals.total)}</span></div>
              </div>
            </div>

            <div style={{ ...section, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, paddingTop: 12, paddingBottom: 10 }} className="expense-order-print-section expense-order-print-grid expense-order-print-keep">
              <div>
                <div style={label}>Elaborado por</div>
                <div style={{ marginTop: 24, borderTop: '1px solid var(--fg,#0f172a)', paddingTop: 6, fontSize: 11.5, fontWeight: 800 }}>{data.user || 'Sin registro'}</div>
                <div style={{ marginTop: 24, borderTop: '1px solid var(--fg,#0f172a)', paddingTop: 6, fontSize: 11.5, fontWeight: 800 }}>{data.order.aprobada ? 'Firma autorizada' : 'Pendiente'}</div>
              </div>
              <div>
                <div style={label}>Recibido por</div>
                <div style={{ marginTop: 24, borderTop: '1px solid var(--fg,#0f172a)', paddingTop: 6, fontSize: 11.5, fontWeight: 800 }}>Firma y sello</div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
