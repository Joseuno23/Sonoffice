import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fmtMoneyFull } from '../lib/format';
import { api } from '../services/api';

interface PrintData {
  company: { name: string; commercialName: string | null; nit: string | null; address: string | null; city: string | null; department: string | null; country: string | null; phone: string | null };
  order: { id: number; fecha: string | null; estado: string | null; tipo: string | null; copyLabel: string; observacion: string | null; finalObservation: string | null };
  client: Party;
  provider: Party;
  campaign: string | null;
  product: string | null;
  service: string | null;
  budgets: { ppto: number; tipo: number | null }[];
  details: { idDetalle: number; detalle: string; cantidad: number; valor: number; total: number }[];
  totals: { valor: number; descuento: number; subtotal: number; iva: number; total: number; porcDescuento: number; porcIva: number };
  creator: { name: string | null; email: string | null };
}

interface Party { name: string | null; nit: string | null; address: string | null; phone: string | null; city: string | null }

const page: CSSProperties = { minHeight: '100vh', background: 'var(--bg,#f3f5f8)', padding: '24px 16px 40px', color: 'var(--fg,#0f172a)' };
const sheet: CSSProperties = { width: 'min(980px, 100%)', margin: '0 auto', background: '#fff', border: '1px solid var(--border,#e5e8ec)', borderRadius: 18, boxShadow: '0 18px 45px rgba(15,23,42,.10)', overflow: 'hidden' };
const section: CSSProperties = { padding: '18px 24px', borderTop: '1px solid var(--border,#e5e8ec)' };
const label: CSSProperties = { fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 800, color: 'var(--muted,#64748b)' };
const value: CSSProperties = { marginTop: 5, fontSize: 13.5, color: 'var(--fg,#0f172a)', fontWeight: 650 };
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

export default function CostOrderPrint() {
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
    api.getCostOrderPrintData(id)
      .then((res) => {
        if (!live) return;
        if (res?.success) setData(res.data);
        else setError(res?.message || 'No se pudo cargar la orden de costo');
      })
      .catch(() => { if (live) setError('No se pudo cargar la orden de costo'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  const runPrint = async () => {
    if (!id || printing) return;
    setPrinting(true);
    setError(null);
    try {
      const res = await api.printCostOrder(id);
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
    document.title = `OC_${fileSafe(data.order.id)}_${fileSafe(data.provider.name)}`;
    return () => { document.title = previousTitle; };
  }, [data]);

  return (
    <div style={page} className="cost-order-print-page">
      <style>{`
        @page { size: A4; margin: 14mm 12mm; }
        .cost-order-print-page, .cost-order-print-page * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .cost-order-print-keep {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .cost-order-print-details tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .cost-order-print-details thead {
          display: table-header-group;
        }
        @media print {
          html, body, #root { background: #fff !important; }
          .cost-order-print-page { padding: 0 !important; background: #fff !important; }
          .cost-order-print-toolbar { display: none !important; }
          .cost-order-print-sheet { width: 100% !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; }
          .cost-order-print-header { background: linear-gradient(135deg, #e6f7fb, #f8fafc) !important; border: 1px solid #dbeafe !important; border-radius: 14px !important; margin-bottom: 10px !important; }
          .cost-order-print-section { border-top-color: #e2e8f0 !important; }
          .cost-order-print-grid { break-inside: avoid; page-break-inside: avoid; }
        }
        @media (max-width: 720px) {
          .cost-order-print-grid { grid-template-columns: 1fr !important; }
          .cost-order-print-header { flex-direction: column !important; align-items: flex-start !important; }
        }
      `}</style>

      <div className="cost-order-print-toolbar" style={{ width: 'min(980px, 100%)', margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--muted,#64748b)' }}>Vista de impresión de orden de costo</div>
        <button onClick={runPrint} disabled={!data || printing} style={{ height: 40, padding: '0 18px', border: 'none', borderRadius: 11, background: 'var(--brand,#0891b2)', color: '#fff', fontWeight: 800, cursor: !data || printing ? 'default' : 'pointer', opacity: !data || printing ? .6 : 1 }}>
          {printing ? 'Preparando...' : 'Imprimir'}
        </button>
      </div>

      <div className="cost-order-print-sheet" style={sheet}>
        {loading ? (
          <div style={{ padding: 42, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Cargando orden...</div>
        ) : error ? (
          <div style={{ padding: 42, textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>{error}</div>
        ) : data ? (
          (() => {
            const headerObservation = data.order.observacion?.trim();
            const finalObservation = data.order.finalObservation?.trim();
            const observations = [headerObservation, finalObservation].filter(Boolean) as string[];
            return (
          <>
            <div className="cost-order-print-header cost-order-print-keep" style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, background: 'linear-gradient(135deg, rgba(8,145,178,.10), rgba(15,23,42,.02))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src="/logo.png" alt="Sonoffice" style={{ width: 46, height: 46 }} />
                <div>
                  <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-.02em' }}>{data.company.name}</div>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--muted,#64748b)' }}>
                    {[data.company.nit ? `NIT ${data.company.nit}` : null, data.company.address, data.company.city, data.company.phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 32, fontWeight: 950 }}>#{data.order.id}</div></div>
            </div>

            <div style={{ ...section, paddingTop: 13, paddingBottom: 13 }} className="cost-order-print-section cost-order-print-keep"><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', columnGap: 26, rowGap: 6 }} className="cost-order-print-grid"><CompactRow label="Cliente" value={data.client.name} /><CompactRow label="NIT cliente" value={data.client.nit} /><CompactRow label="Proveedor" value={data.provider.name} /><CompactRow label="NIT proveedor" value={data.provider.nit} /><CompactRow label="Campaña" value={data.campaign} /><CompactRow label="Fecha" value={formatDate(data.order.fecha)} /></div></div>

            <div style={section} className="cost-order-print-section">
              <div style={{ ...label, marginBottom: 10, textAlign: 'center' }}>Detalle</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="cost-order-print-details" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead><tr><th style={{ ...th, width: '52%' }}>Descripción</th><th style={{ ...th, width: '12%', textAlign: 'right' }}>Cantidad</th><th style={{ ...th, width: '18%', textAlign: 'right' }}>Valor unitario</th><th style={{ ...th, width: '18%', textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {data.details.map((detail) => (
                      <tr key={detail.idDetalle}>
                        <td style={{ ...td, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail.detalle}</td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{detail.cantidad.toLocaleString('es-CO')}</td>
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtMoneyFull(detail.valor)}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: 'var(--fg,#0f172a)', whiteSpace: 'nowrap' }}>{fmtMoneyFull(detail.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...section, display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 14, paddingTop: 14, paddingBottom: 14 }} className="cost-order-print-section cost-order-print-grid cost-order-print-keep">
              <div>
                <div style={label}>Observación</div>
                <div style={{ marginTop: 6, minHeight: 38, padding: 10, border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, fontSize: 11.5, color: 'var(--fg-2,#334155)', whiteSpace: 'pre-wrap', display: 'flex', flexDirection: 'column', gap: 8 }}>{observations.length ? observations.map((item, index) => <div key={`${index}-${item}`}>{item}</div>) : 'Sin observaciones'}</div>
              </div>
              <div style={{ border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, padding: 11 }}>
                {[
                  ['Valor bruto', data.totals.valor],
                  [`Descuento (${data.totals.porcDescuento}%)`, -data.totals.descuento],
                  ['Subtotal', data.totals.subtotal],
                  [`IVA (${data.totals.porcIva}%)`, data.totals.iva],
                ].map(([name, amount]) => (
                  <div key={String(name)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontSize: 11.5, color: 'var(--fg-2,#334155)' }}><span>{name}</span><b>{fmtMoneyFull(Number(amount))}</b></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border,#e5e8ec)', fontSize: 14, fontWeight: 900 }}><span>Total</span><span>{fmtMoneyFull(data.totals.total)}</span></div>
              </div>
            </div>

            <div style={{ ...section, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, paddingTop: 12, paddingBottom: 10 }} className="cost-order-print-section cost-order-print-grid cost-order-print-keep">
              <div>
                <div style={label}>Elaboró</div>
                <div style={{ marginTop: 24, borderTop: '1px solid var(--fg,#0f172a)', paddingTop: 6, fontSize: 11.5, fontWeight: 800 }}>{data.creator.name || 'Sin registro'}</div>
                {data.creator.email && <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted,#64748b)' }}>{data.creator.email}</div>}
              </div>
              <div>
                <div style={label}>Recibido / Aprobado</div>
                <div style={{ marginTop: 24, borderTop: '1px solid var(--fg,#0f172a)', paddingTop: 6, fontSize: 11.5, fontWeight: 800 }}>Firma y sello</div>
              </div>
            </div>
          </>
            );
          })()
        ) : null}
      </div>
    </div>
  );
}
