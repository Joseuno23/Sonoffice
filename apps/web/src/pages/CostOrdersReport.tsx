import { useEffect, useState, type CSSProperties } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const input: CSSProperties = { width: '100%', minHeight: 38, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const label: CSSProperties = { display: 'block', marginBottom: 7, fontSize: 12.5, fontWeight: 700, color: 'var(--fg-2,#334155)' };

interface Option { id: number; label: string; }

function today() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function CostOrdersReport() {
  const [fechaIni, setFechaIni] = useState(firstDayOfMonth());
  const [fechaFin, setFechaFin] = useState(today());
  const [cliente, setCliente] = useState('all');
  const [proveedor, setProveedor] = useState('all');
  const [clientes, setClientes] = useState<Option[]>([]);
  const [proveedores, setProveedores] = useState<Option[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.getCostOrdersReportOptions()
      .then((res) => {
        if (!live) return;
        if (res?.success) {
          setClientes(res.data?.clientes || []);
          setProveedores(res.data?.proveedores || []);
        }
      })
      .catch(() => { if (live) setError('No se pudieron cargar clientes/proveedores. Podés generar el reporte con Todos.'); })
      .finally(() => { if (live) setLoadingOptions(false); });
    return () => { live = false; };
  }, []);

  const download = () => {
    setError(null);
    setSuccess(null);
    if (!fechaIni || !fechaFin) {
      setError('Fecha desde y fecha hasta son obligatorias.');
      return;
    }
    if (fechaIni > fechaFin) {
      setError('La fecha desde no puede ser mayor a la fecha hasta.');
      return;
    }

    setDownloading(true);
    api.downloadCostOrdersReport({ fechaIni, fechaFin, cliente, proveedor })
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setSuccess('Reporte generado correctamente.');
      })
      .catch(() => setError('No se pudo generar el reporte de órdenes de costo.'))
      .finally(() => setDownloading(false));
  };

  return (
    <>
      <PageHeader
        crumb="Reportes · Órdenes de costo · General"
        title="Órdenes de costo · General"
        sub="Generá el reporte descargable por rango de fecha, cliente y proveedor."
        primary={{ label: downloading ? 'Generando…' : 'Generar / Descargar', onClick: download }}
      />

      {error && <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' }}>{error}</div>}
      {success && <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#047857', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.20)' }}>{success}</div>}

      <div style={card}>
        <div style={{ padding: 20, borderBottom: '1px solid var(--border,#e5e8ec)' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>Filtros del reporte</div>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--muted,#64748b)' }}>Las fechas son obligatorias. Cliente y proveedor pueden quedar en Todos.</div>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div>
            <label style={label}>Fecha desde *</label>
            <input type="date" value={fechaIni} onChange={(event) => setFechaIni(event.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Fecha hasta *</label>
            <input type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} style={input} />
          </div>
          <div>
            <label style={label}>Cliente</label>
            <select value={cliente} onChange={(event) => setCliente(event.target.value)} style={input} disabled={loadingOptions}>
              <option value="all">Todos</option>
              {clientes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Proveedor</label>
            <select value={proveedor} onChange={(event) => setProveedor(event.target.value)} style={input} disabled={loadingOptions}>
              <option value="all">Todos</option>
              {proveedores.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            style={{ height: 40, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 800, fontSize: 13.5, cursor: downloading ? 'wait' : 'pointer', opacity: downloading ? .65 : 1 }}
          >
            {downloading ? 'Generando…' : 'Generar / Descargar'}
          </button>
        </div>
      </div>
    </>
  );
}
