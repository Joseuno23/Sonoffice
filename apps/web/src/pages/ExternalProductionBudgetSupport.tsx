import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AlertMessage from '../components/AlertMessage';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import { Icon } from '../lib/icons';
import { api } from '../services/api';

type Message = { type: 'success' | 'error'; text: string } | null;
type Attachment = { nombre: string | null; fecha: string | null; downloadUrl?: string | null };
type SupportData = { budget?: { id: number; idEstado: number | null; estado: string | null; canUpload: boolean }; attachments?: Attachment[] };

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const btnPrimary: CSSProperties = { height: 40, padding: '0 18px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
const btnGhost: CSSProperties = { height: 38, padding: '0 14px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none' };

export default function ExternalProductionBudgetSupport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<SupportData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [file, setFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);

  const rows = useMemo(() => data.attachments || [], [data.attachments]);
  const canUpload = data.budget?.canUpload !== false;

  const load = () => {
    if (!id) return;
    setLoading(true);
    api.getExternalProductionBudgetSupport(id)
      .then((res) => {
        if (res?.success) setData(res.data || {});
        else setMessage({ type: 'error', text: res?.message || 'No se pudo cargar el soporte.' });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo cargar el soporte.' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const selectFile = (selected?: File) => {
    setMessage(null);
    if (!selected) { setFile(null); return; }
    if (selected.size > 10 * 1024 * 1024) { setFile(null); setMessage({ type: 'error', text: 'El archivo no debe superar 10 MB.' }); return; }
    setFile(selected);
  };

  const upload = () => {
    if (!id || !file || !canUpload) return;
    setSaving(true);
    api.uploadExternalProductionBudgetSupport(id, file)
      .then((res) => {
        if (!res?.success) { setMessage({ type: 'error', text: res?.message || 'No se pudo cargar el soporte.' }); return; }
        setMessage({ type: 'success', text: res.message || 'Soporte cargado correctamente.' });
        setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        load();
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo cargar el soporte.' }))
      .finally(() => setSaving(false));
  };

  const remove = () => {
    if (!id || !deleteTarget?.nombre) return;
    setSaving(true);
    api.deleteExternalProductionBudgetSupport(id, deleteTarget.nombre)
      .then((res) => {
        if (res?.success) { setMessage({ type: 'success', text: res.message || 'Soporte eliminado correctamente.' }); setDeleteTarget(null); load(); }
        else setMessage({ type: 'error', text: res?.message || 'No se pudo eliminar el soporte.' });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo eliminar el soporte.' }))
      .finally(() => setSaving(false));
  };

  const download = async (row: Attachment) => {
    if (!id || !row.nombre) return;
    try {
      const { blob, filename } = await api.downloadExternalProductionBudgetSupport(id, row.nombre);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || row.nombre;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: 'error', text: 'No se pudo descargar el soporte.' });
    }
  };

  return (
    <>
      <PageHeader crumb="Medios · Presupuestos" title={`Soporte de Pauta #${id || ''}`} sub="Carga y descarga de adjuntos de soporte para presupuesto de Producción Externa." primary={{ label: 'Volver', onClick: () => navigate('/medios/presupuestos/produccion-externa/listar') }} />
      {message && <AlertMessage type={message.type} style={{ marginBottom: 14 }}>{message.text}</AlertMessage>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, .85fr) minmax(360px, 1.15fr)', gap: 18, alignItems: 'start' }}>
        <section style={card}>
          <div style={{ padding: 18, borderBottom: '1px solid var(--border,#e5e8ec)' }}>
            <div style={{ fontSize: 16, fontWeight: 850, color: 'var(--fg,#0f172a)' }}>Cargar archivo</div>
            <div style={{ marginTop: 5, fontSize: 13, color: 'var(--muted,#64748b)' }}>Máximo 10 MB.</div>
          </div>
          <div style={{ padding: 18 }}>
            {!canUpload && <AlertMessage type="error" style={{ marginBottom: 14 }}>El presupuesto está anulado; en el flujo legacy el soporte no se ofrece para anulados.</AlertMessage>}
            <input ref={inputRef} type="file" disabled={!canUpload || saving} onChange={(event) => selectFile(event.target.files?.[0])} style={{ width: '100%', border: '1px dashed var(--border-strong,#d5d9e0)', borderRadius: 12, padding: 14, color: 'var(--fg-2,#334155)', background: 'var(--surface-2,#f7f8fa)' }} />
            {file && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--muted,#64748b)' }}><strong style={{ color: 'var(--fg,#0f172a)' }}>{file.name}</strong> · {(file.size / 1024 / 1024).toFixed(2)} MB</div>}
            <button type="button" onClick={upload} disabled={!file || saving || !canUpload} style={{ ...btnPrimary, marginTop: 16, opacity: !file || saving || !canUpload ? .6 : 1, cursor: !file || saving || !canUpload ? 'default' : 'pointer' }}><Icon d="M12 3v12M7 8l5-5 5 5M5 21h14" size={16} sw={2} />{saving ? 'Cargando…' : 'Cargar'}</button>
          </div>
        </section>

        <section style={card}>
          <div style={{ padding: 18, borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div><div style={{ fontSize: 16, fontWeight: 850, color: 'var(--fg,#0f172a)' }}>Soportes cargados</div><div style={{ marginTop: 5, fontSize: 13, color: 'var(--muted,#64748b)' }}>{loading ? 'Cargando soportes…' : `${rows.length} adjunto(s)`}</div></div>
          </div>
          {rows.length ? rows.map((row, index) => {
            return <div key={`${row.nombre || 'adjunto'}-${row.fecha || index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border,#e5e8ec)' }}>
              <div style={{ minWidth: 0 }}><div style={{ color: 'var(--fg,#0f172a)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nombre || 'Adjunto'}</div><div style={{ marginTop: 4, color: 'var(--muted,#64748b)', fontSize: 12.5 }}>{row.fecha || ''}</div></div>
              <div style={{ display: 'flex', gap: 8, flex: 'none' }}><button type="button" onClick={() => void download(row)} style={btnGhost}><Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={15} sw={2} />Descargar</button><button type="button" onClick={() => setDeleteTarget(row)} style={{ ...btnGhost, color: '#dc2626' }}><Icon d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" size={15} sw={2} />Eliminar</button></div>
            </div>;
          }) : !loading && <div style={{ padding: 42, textAlign: 'center', color: 'var(--muted,#64748b)' }}>No hay soportes cargados para este presupuesto.</div>}
        </section>
      </div>

      <ConfirmDialog open={!!deleteTarget} title="Eliminar soporte" description={`Se eliminará ${deleteTarget?.nombre || 'el adjunto'} del soporte de pauta.`} confirmLabel="Eliminar" tone="danger" loading={saving} onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
    </>
  );
}
