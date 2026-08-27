import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fmtMoneyFull } from '../lib/format';
import { api } from '../services/api';

interface PrintData {
  company: { name: string; commercialName: string | null; nit: string | null; address: string | null; city: string | null; department: string | null; country: string | null; phone: string | null };
  order: { id: number; fecha: string | null; estado: string | null; tipo: string | null; copyLabel: string; observacion: string | null };
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

function Empty({ text }: { text: string }) {
  return <span style={{ color: 'var(--muted,#64748b)', fontWeight: 500 }}>{text}</span>;
}

function InfoBlock({ title, party }: { title: string; party: Party }) {
  return (
    <div style={{ border: '1px solid var(--border,#e5e8ec)', borderRadius: 14, padding: 14, background: 'var(--surface-2,#f7f8fa)' }}>
      <div style={label}>{title}</div>
      <div style={{ ...value, fontSize: 15 }}>{party.name || <Empty text="Sin nombre" />}</div>
      <div style={{ marginTop: 9, display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--fg-2,#334155)' }}>
        <span>NIT/CC: {party.nit || 'No registrado'}</span>
        <span>Dirección: {party.address || 'No registrada'}</span>
        <span>Ciudad: {party.city || 'No registrada'}</span>
        <span>Teléfono: {party.phone || 'No registrado'}</span>
      </div>
    </div>
  );
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
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, fontWeight: 900, color: 'var(--brand,#0891b2)', letterSpacing: '.14em' }}>{data.order.copyLabel}</div>
                <div style={{ marginTop: 3, fontSize: 26, fontWeight: 950, letterSpacing: '-.04em' }}>OC #{data.order.id}</div>
                <div style={{ marginTop: 5, fontSize: 12.5, color: 'var(--muted,#64748b)' }}>{formatDate(data.order.fecha)}</div>
              </div>
            </div>

            <div style={section} className="cost-order-print-section cost-order-print-keep">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }} className="cost-order-print-grid">
                <div><div style={label}>Estado</div><div style={value}>{data.order.estado || 'Sin estado'}</div></div>
                <div><div style={label}>Tipo</div><div style={value}>{data.order.tipo || 'Sin tipo'}</div></div>
                <div><div style={label}>Campaña</div><div style={value}>{data.campaign || 'No registrada'}</div></div>
                <div><div style={label}>Servicio</div><div style={value}>{data.service || 'No registrado'}</div></div>
              </div>
              <div style={{ marginTop: 14 }}><div style={label}>Producto / Rubro</div><div style={value}>{data.product || 'No registrado'}</div></div>
            </div>

            <div style={{ ...section, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="cost-order-print-section cost-order-print-grid cost-order-print-keep">
              <InfoBlock title="Cliente" party={data.client} />
              <InfoBlock title="Proveedor" party={data.provider} />
            </div>

            {data.budgets.length > 0 && (
              <div style={section} className="cost-order-print-section cost-order-print-keep">
                <div style={label}>Presupuestos asociados</div>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.budgets.map((budget) => <span key={`${budget.tipo}-${budget.ppto}`} style={{ padding: '5px 9px', borderRadius: 999, background: 'rgba(8,145,178,.10)', color: 'var(--brand,#0891b2)', fontSize: 12, fontWeight: 800 }}>Tipo {budget.tipo || '-'} · #{budget.ppto}</span>)}
                </div>
              </div>
            )}

            <div style={section} className="cost-order-print-section">
              <div style={{ ...label, marginBottom: 10 }}>Detalle</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="cost-order-print-details" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>Descripción</th><th style={{ ...th, textAlign: 'right' }}>Cantidad</th><th style={{ ...th, textAlign: 'right' }}>Valor unitario</th><th style={{ ...th, textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {data.details.map((detail) => (
                      <tr key={detail.idDetalle}>
                        <td style={{ ...td, width: '55%' }}>{detail.detalle}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{detail.cantidad.toLocaleString('es-CO')}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtMoneyFull(detail.valor)}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: 'var(--fg,#0f172a)' }}>{fmtMoneyFull(detail.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...section, display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 18 }} className="cost-order-print-section cost-order-print-grid cost-order-print-keep">
              <div>
                <div style={label}>Observación</div>
                <div style={{ marginTop: 8, minHeight: 70, padding: 12, border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, fontSize: 12.5, color: 'var(--fg-2,#334155)', whiteSpace: 'pre-wrap' }}>{data.order.observacion || 'Sin observaciones'}</div>
              </div>
              <div style={{ border: '1px solid var(--border,#e5e8ec)', borderRadius: 14, padding: 14 }}>
                {[
                  ['Valor bruto', data.totals.valor],
                  [`Descuento (${data.totals.porcDescuento}%)`, -data.totals.descuento],
                  ['Subtotal', data.totals.subtotal],
                  [`IVA (${data.totals.porcIva}%)`, data.totals.iva],
                ].map(([name, amount]) => (
                  <div key={String(name)} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 12.5, color: 'var(--fg-2,#334155)' }}><span>{name}</span><b>{fmtMoneyFull(Number(amount))}</b></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border,#e5e8ec)', fontSize: 17, fontWeight: 950 }}><span>Total</span><span>{fmtMoneyFull(data.totals.total)}</span></div>
              </div>
            </div>

            <div style={{ ...section, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} className="cost-order-print-section cost-order-print-grid cost-order-print-keep">
              <div>
                <div style={label}>Elaboró</div>
                <div style={{ marginTop: 36, borderTop: '1px solid var(--fg,#0f172a)', paddingTop: 8, fontSize: 13, fontWeight: 800 }}>{data.creator.name || 'Sin registro'}</div>
                {data.creator.email && <div style={{ marginTop: 3, fontSize: 12, color: 'var(--muted,#64748b)' }}>{data.creator.email}</div>}
              </div>
              <div>
                <div style={label}>Recibido / Aprobado</div>
                <div style={{ marginTop: 36, borderTop: '1px solid var(--fg,#0f172a)', paddingTop: 8, fontSize: 13, fontWeight: 800 }}>Firma y sello</div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
