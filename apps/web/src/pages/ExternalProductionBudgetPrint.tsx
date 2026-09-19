import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fmtMoneyFull } from '../lib/format';
import { api } from '../services/api';

interface Party { name: string | null; nit: string | null; address: string | null; phone: string | null; city: string | null }
interface PrintData {
  company: { name: string; nit: string | null; address: string | null; city: string | null; phone: string | null };
  budget: { id: number; fecha: string | null; estado: string | null; copyLabel: string; ordenCliente: string | null; cotizacion: string | null; observacion: string | null; factura: string | number | null };
  order: { id: number | null; observacion: string | null };
  client: Party;
  provider: Party;
  campaign: string | null;
  product: string | null;
  service: string | null;
  details: { id: number; detalle: string; valor: number; incentivo: number; incentivoArea: string | null; incentivoMedio: string | null }[];
  totals: { valor: number; descuento: number; subtotal: number; iva: number; subtotalConIva: number; spa: number; ivaSpa: number; total: number; porcDescuento: number; porcIva: number; porcSpa: number; porcIvaSpa: number };
  creator: { name: string | null };
}

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

export default function ExternalProductionBudgetPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoPrintStarted = useRef(false);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null);
    api.getExternalProductionBudgetPrintData(id)
      .then((res) => { if (!live) return; res?.success ? setData(res.data) : setError(res?.message || 'No se pudo cargar el presupuesto'); })
      .catch(() => { if (live) setError('No se pudo cargar el presupuesto'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  const runPrint = async () => {
    if (!id || printing) return;
    setPrinting(true); setError(null);
    try {
      const res = await api.printExternalProductionBudget(id);
      if (!res?.success) { setError(res?.message || 'No se pudo preparar la impresión'); return; }
      window.print();
    } catch { setError('No se pudo preparar la impresión'); }
    finally { setPrinting(false); }
  };

  useEffect(() => {
    if (!data || params.get('autoprint') !== '1' || autoPrintStarted.current) return;
    autoPrintStarted.current = true;
    window.setTimeout(() => { void runPrint(); }, 150);
  }, [data, params]);

  useEffect(() => {
    if (!data) return;
    const previousTitle = document.title;
    document.title = `Produccion-Externa_${fileSafe(data.budget.id)}_${fileSafe(data.client.name)}`;
    return () => { document.title = previousTitle; };
  }, [data]);

  return <div style={page} className="external-budget-print-page">
    <style>{`
      @page { size: A4; margin: 14mm 12mm; }
      .external-budget-print-page, .external-budget-print-page * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .external-budget-print-keep { break-inside: avoid; page-break-inside: avoid; }
      .external-budget-print-details tr { break-inside: avoid; page-break-inside: avoid; }
      .external-budget-print-details thead { display: table-header-group; }
      @media print { html, body, #root { background: #fff !important; } .external-budget-print-page { padding: 0 !important; background: #fff !important; } .external-budget-print-toolbar { display: none !important; } .external-budget-print-sheet { width: 100% !important; border: none !important; box-shadow: none !important; border-radius: 0 !important; overflow: visible !important; } }
      @media (max-width: 720px) { .external-budget-print-grid { grid-template-columns: 1fr !important; } }
    `}</style>
    <div className="external-budget-print-toolbar" style={{ width: 'min(980px, 100%)', margin: '0 auto 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--muted,#64748b)' }}>Vista de impresión de presupuesto Producción Externa</div>
      <button onClick={runPrint} disabled={!data || printing} style={{ height: 40, padding: '0 18px', border: 'none', borderRadius: 11, background: 'var(--brand,#0891b2)', color: '#fff', fontWeight: 800, cursor: !data || printing ? 'default' : 'pointer', opacity: !data || printing ? .6 : 1 }}>{printing ? 'Preparando...' : 'Imprimir'}</button>
    </div>
    <div className="external-budget-print-sheet" style={sheet}>{loading ? <div style={{ padding: 42, textAlign: 'center', color: 'var(--muted,#64748b)' }}>Cargando presupuesto...</div> : error ? <div style={{ padding: 42, textAlign: 'center', color: '#b91c1c', fontWeight: 700 }}>{error}</div> : data && <>
      <div className="external-budget-print-keep" style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, background: 'linear-gradient(135deg, rgba(8,145,178,.10), rgba(15,23,42,.02))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}><img src="/logo.png" alt="Sonoffice" style={{ width: 46, height: 46 }} /><div><div style={{ fontSize: 19, fontWeight: 900 }}>{data.company.name}</div><div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--muted,#64748b)' }}>{[data.company.nit ? `NIT ${data.company.nit}` : null, data.company.address, data.company.city, data.company.phone].filter(Boolean).join(' · ')}</div></div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 32, fontWeight: 950 }}>#{data.budget.id}</div></div>
      </div>
      <div style={{ ...section, paddingTop: 13, paddingBottom: 13 }} className="external-budget-print-keep"><div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', columnGap: 26, rowGap: 6 }} className="external-budget-print-grid"><CompactRow label="Tipo" value="Producción Externa" /><CompactRow label="Estado" value={data.budget.estado} /><CompactRow label="Cliente" value={data.client.name} /><CompactRow label="NIT cliente" value={data.client.nit} /><CompactRow label="Proveedor" value={data.provider.name} /><CompactRow label="NIT proveedor" value={data.provider.nit} /><CompactRow label="Campaña" value={data.campaign} /><CompactRow label="Copia" value={data.budget.copyLabel} /><CompactRow label="Servicio" value={data.service} /><CompactRow label="Fecha" value={formatDate(data.budget.fecha)} /><CompactRow label="Producto" value={data.product} /><CompactRow label="Orden proveedor" value={data.order.id} /><CompactRow label="Orden cliente" value={data.budget.ordenCliente} /><CompactRow label="N° presupuesto" value={data.budget.id} /><CompactRow label="Cotización" value={data.budget.cotizacion} /><CompactRow label="Factura" value={data.budget.factura} /></div></div>
      <div style={section}><div style={{ ...label, marginBottom: 10, textAlign: 'center' }}>Detalles del servicio</div><table className="external-budget-print-details" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}><thead><tr><th style={{ ...th, width: '58%' }}>Detalle</th><th style={{ ...th, width: '24%' }}>Incentivo</th><th style={{ ...th, width: '18%', textAlign: 'right' }}>Valor</th></tr></thead><tbody>{data.details.map((detail) => <tr key={detail.id}><td style={{ ...td, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail.detalle}</td><td style={{ ...td, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{detail.incentivo > 0 ? [detail.incentivoArea, detail.incentivoMedio].filter(Boolean).join(' · ') || `#${detail.incentivo}` : '—'}</td><td style={{ ...td, textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{fmtMoneyFull(detail.valor)}</td></tr>)}</tbody></table></div>
      <div style={{ ...section, display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 14, paddingTop: 14, paddingBottom: 14 }} className="external-budget-print-grid external-budget-print-keep"><div><div style={label}>Observaciones</div><div style={{ marginTop: 6, minHeight: 38, padding: 10, border: '1px solid var(--border,#e5e8ec)', borderRadius: 10, fontSize: 11.5, color: 'var(--fg-2,#334155)', whiteSpace: 'pre-wrap' }}>{data.budget.observacion || 'Sin observaciones'}</div></div><div style={{ border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, padding: 11 }}>{[['Valor', data.totals.valor], [`Descuento (${data.totals.porcDescuento}%)`, -data.totals.descuento], ['Subtotal', data.totals.subtotal], [`IVA (${data.totals.porcIva}%)`, data.totals.iva], ['Subtotal', data.totals.subtotalConIva], [`SPA (${data.totals.porcSpa}%)`, data.totals.spa], [`IVA SPA (${data.totals.porcIvaSpa}%)`, data.totals.ivaSpa]].map(([name, amount]) => <div key={String(name)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '3px 0', fontSize: 11.5 }}><span>{name}</span><b>{fmtMoneyFull(Number(amount))}</b></div>)}<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border,#e5e8ec)', fontSize: 14, fontWeight: 900 }}><span>Total</span><span>{fmtMoneyFull(data.totals.total)}</span></div></div></div>
      <div style={{ ...section, paddingTop: 12, paddingBottom: 10 }}><div style={label}>Nota</div><div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.35, color: 'var(--fg-2,#334155)' }}>Su firma en este presupuesto constituye su aprobación y autorización para que por su cuenta ordenemos todo el trabajo y servicio comprendido en el mismo a los precios y condiciones sujetos a aceptación de medios y proveedores.</div><div className="external-budget-print-keep" style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, textAlign: 'center', fontSize: 11 }}><div><b>{data.creator.name || ''}</b><div style={{ borderTop: '1px solid #334155', marginTop: 14, paddingTop: 5 }}>Dpto de medios</div></div><div><div style={{ borderTop: '1px solid #334155', marginTop: 29, paddingTop: 5 }}>Ejecutivo de cuentas</div></div><div><div style={{ borderTop: '1px solid #334155', marginTop: 29, paddingTop: 5 }}>Cliente aprobación</div></div></div></div>
    </>}</div>
  </div>;
}
