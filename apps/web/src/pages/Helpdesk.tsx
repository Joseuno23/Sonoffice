import { useEffect, useMemo, useState } from 'react';
import AlertMessage from '../components/AlertMessage';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { TableSkeleton } from '../components/Skeletons';
import { useAuth } from '../auth/AuthContext';
import { api, assetUrl } from '../services/api';

const card = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th = { textAlign: 'left' as const, padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const input = { width: '100%', minHeight: 38, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const };
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--fg-2,#334155)', marginBottom: 6 };
const modalAlert = { padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' };
const ROOT_ROLE_ID = 1;
const CHIPS = ['Todos', 'Pendientes', 'Resueltos', 'Por calificar'];
const PER = 8;

function asHelpdeskData(response) {
  return response?.success ? response.data : { tickets: [], metrics: { open: 0, resolved: 0, total: 0 }, pendingRatings: [], canCreate: true, isAdmin: false };
}

function statusLabel(status) {
  return status === 'resolved' ? 'Resuelto' : 'Pendiente';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('es-CO') : 'Sin registro';
}

function Stars({ value = 0, onRate = null }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onRate}
          onClick={() => onRate?.(star)}
          style={{ border: 'none', background: 'transparent', color: star <= value ? '#f59e0b' : 'var(--border-strong,#cbd5e1)', fontSize: 18, cursor: onRate ? 'pointer' : 'default', padding: 0 }}
          aria-label={`Calificar ${star} estrellas`}
        >
          ★
        </button>
      ))}
    </span>
  );
}

export default function Helpdesk() {
  const { user } = useAuth();
  const isAdmin = user?.roleId === ROOT_ROLE_ID;
  const [tickets, setTickets] = useState([]);
  const [metrics, setMetrics] = useState({ open: 0, resolved: 0, total: 0 });
  const [pendingRatings, setPendingRatings] = useState([]);
  const [canCreate, setCanCreate] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resolveTicket, setResolveTicket] = useState(null);
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [serviceDetails, setServiceDetails] = useState([]);
  const [resolveForm, setResolveForm] = useState({ serviceType: '', serviceDetail: '', adminObservations: '' });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Todos');
  const [page, setPage] = useState(1);

  const orderedTickets = useMemo(() => {
    let rows = [...tickets];
    const term = q.trim().toLowerCase();

    if (term) {
      rows = rows.filter((ticket) => [
        ticket.id,
        ticket.creatorName,
        ticket.description,
        ticket.attachmentOriginalName,
        statusLabel(ticket.status),
        ticket.serviceType,
        ticket.serviceDetail,
        ticket.adminObservations,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)));
    }

    if (status !== 'Todos') {
      rows = rows.filter((ticket) => {
        if (status === 'Pendientes') return ticket.status === 'open';
        if (status === 'Resueltos') return ticket.status === 'resolved';
        if (status === 'Por calificar') return ticket.creatorUserId === user?.id && ticket.status === 'resolved' && !ticket.rating;
        return true;
      });
    }

    return rows.sort((a, b) => Number(b.id) - Number(a.id));
  }, [tickets, q, status, user?.id]);

  const total = orderedTickets.length;
  const totalPages = Math.max(1, Math.ceil(total / PER));
  const curPage = Math.min(page, totalPages);
  const pageRows = orderedTickets.slice((curPage - 1) * PER, curPage * PER);

  const load = () => {
    setLoading(true);
    return api.getHelpdesk()
      .then((response) => {
        const data = asHelpdeskData(response);
        setTickets(data.tickets || []);
        setMetrics(data.metrics || { open: 0, resolved: 0, total: 0 });
        setPendingRatings(data.pendingRatings || []);
        setCanCreate(data.canCreate !== false);
        if (response?.success === false) setMessage({ type: 'error', text: response.message || 'No se pudo cargar Mesa de ayuda.' });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo cargar Mesa de ayuda.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let live = true;
    api.getHelpdesk()
      .then((response) => {
        if (!live) return;
        const data = asHelpdeskData(response);
        setTickets(data.tickets || []);
        setMetrics(data.metrics || { open: 0, resolved: 0, total: 0 });
        setPendingRatings(data.pendingRatings || []);
        setCanCreate(data.canCreate !== false);
      })
      .catch(() => { if (live) setMessage({ type: 'error', text: 'No se pudo cargar Mesa de ayuda.' }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    api.getHelpdeskServiceTypes()
      .then((response) => setServiceTypes(response?.success ? response.data || [] : []))
      .catch(() => setServiceTypes([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!attachment) {
      setPreview(null);
      return;
    }
    if (!attachment.type?.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(attachment);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  const openCreate = () => {
    if (!canCreate) {
      setMessage({ type: 'error', text: 'Primero califica los tickets resueltos pendientes.' });
      return;
    }
    setDescription('');
    setAttachment(null);
    setModalError(null);
    setCreateOpen(true);
    setMessage(null);
  };

  const closeCreate = () => {
    if (saving) return;
    setCreateOpen(false);
    setModalError(null);
  };

  const submitCreate = (event) => {
    event.preventDefault();
    setSaving(true);
    setModalError(null);
    api.createHelpdeskTicket({ description }, attachment)
      .then((response) => {
        if (response?.success === false) {
          setModalError(response.message || 'No se pudo crear el ticket.');
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Ticket creado correctamente.' });
        setCreateOpen(false);
        setModalError(null);
        setDescription('');
        setAttachment(null);
        load();
      })
      .catch(() => setModalError('No se pudo crear el ticket.'))
      .finally(() => setSaving(false));
  };

  const openResolve = (ticket) => {
    setResolveTicket(ticket);
    setResolveForm({ serviceType: ticket.serviceType || '', serviceDetail: ticket.serviceDetail || '', adminObservations: ticket.adminObservations || '' });
    setServiceDetails([]);
    setModalError(null);
    if (ticket.serviceType) loadServiceDetails(ticket.serviceType);
  };

  const closeResolve = () => {
    if (saving) return;
    setResolveTicket(null);
    setModalError(null);
  };

  const loadServiceDetails = (serviceType) => {
    setResolveForm((current) => ({ ...current, serviceType, serviceDetail: '' }));
    setServiceDetails([]);
    if (!serviceType) return;
    api.getHelpdeskServiceDetails(serviceType)
      .then((response) => setServiceDetails(response?.success ? response.data || [] : []))
      .catch(() => setServiceDetails([]));
  };

  const submitResolve = (event) => {
    event.preventDefault();
    if (!resolveTicket) return;
    setSaving(true);
    setModalError(null);
    api.resolveHelpdeskTicket(resolveTicket.id, resolveForm)
      .then((response) => {
        if (response?.success === false) {
          setModalError(response.message || 'No se pudo resolver el ticket.');
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Ticket resuelto correctamente.' });
        setResolveTicket(null);
        setModalError(null);
        load();
      })
      .catch(() => setModalError('No se pudo resolver el ticket.'))
      .finally(() => setSaving(false));
  };

  const rate = (ticket, rating) => {
    setMessage(null);
    api.rateHelpdeskTicket(ticket.id, rating)
      .then((response) => {
        if (response?.success === false) {
          setMessage({ type: 'error', text: response.message || 'No se pudo calificar el ticket.' });
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Ticket calificado correctamente.' });
        load();
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo calificar el ticket.' }));
  };

  const primary = { label: canCreate ? 'Nuevo ticket' : 'Calificación pendiente', onClick: openCreate };
  const clearFilters = () => { setQ(''); setStatus('Todos'); setPage(1); };
  const chipStyle = (active) => active
    ? { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', border: '1px solid var(--primary,#0f172a)' }
    : { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', border: '1px solid var(--border,#e5e8ec)' };

  return (
    <>
      <PageHeader crumb="Gestión · Mesa de ayuda" title="Mesa de ayuda" sub="Solicita soporte interno y consulta el estado de tus tickets." primary={primary} />

      {message && <AlertMessage type={message.type}>{message.text}</AlertMessage>}

      {!canCreate && (
        <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.24)', color: '#92400e', fontSize: 13.5, fontWeight: 650 }}>
          Tienes {pendingRatings.length} ticket(s) resueltos pendientes de calificación. Califica para poder crear nuevas solicitudes.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
        {[['Total', metrics.total], ['Pendientes', metrics.open], ['Resueltos', metrics.resolved]].map(([title, value]) => (
          <div key={title} style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--muted,#64748b)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{title}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={q}
            onChange={(event) => { setQ(event.target.value); setPage(1); }}
            placeholder="Buscar por ticket, descripción, solicitante, adjunto o servicio…"
            style={{ ...input, flex: 1, minWidth: 240, height: 38 }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{CHIPS.map((chip) => <button key={chip} onClick={() => { setStatus(chip); setPage(1); }} style={chipStyle(status === chip)}>{chip}</button>)}</div>
        </div>
        {loading ? <TableSkeleton /> : total > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 940 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                    <th style={th}>Ticket</th>
                    {isAdmin && <th style={th}>Solicitante</th>}
                    <th style={th}>Descripción</th>
                    <th style={th}>Adjunto</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Servicio</th>
                    <th style={th}>Calificación</th>
                    {isAdmin && <th style={{ ...th, textAlign: 'right' }}>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((ticket) => {
                    const canRate = ticket.creatorUserId === user?.id && ticket.status === 'resolved' && !ticket.rating;
                    return (
                      <tr key={ticket.id} style={{ borderBottom: '1px solid var(--border,#e5e8ec)' }}>
                        <td style={{ padding: '13px 16px', color: 'var(--brand,#0891b2)', fontFamily: 'JetBrains Mono,monospace', fontWeight: 700 }}>#{ticket.id}<div style={{ color: 'var(--muted,#64748b)', fontFamily: 'inherit', fontSize: 11, marginTop: 3 }}>{formatDate(ticket.createdAt)}</div></td>
                        {isAdmin && <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{ticket.creatorName || `Usuario ${ticket.creatorUserId}`}</td>}
                        <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)', maxWidth: 310 }}>{ticket.description}</td>
                        <td style={{ padding: '13px 16px', fontSize: 12.5 }}>
                          {ticket.attachmentUrl ? (
                            ticket.attachmentIsImage ? <a href={assetUrl(ticket.attachmentUrl)} target="_blank" rel="noreferrer"><img src={assetUrl(ticket.attachmentUrl)} alt={ticket.attachmentOriginalName || 'Adjunto'} style={{ width: 54, height: 42, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border,#e5e8ec)' }} /></a> : <a href={assetUrl(ticket.attachmentUrl)} target="_blank" rel="noreferrer" style={{ color: 'var(--brand,#0891b2)', fontWeight: 700 }}>{ticket.attachmentOriginalName || 'Ver adjunto'}</a>
                          ) : 'Sin adjunto'}
                        </td>
                        <td style={{ padding: '13px 16px' }}><Badge estado={statusLabel(ticket.status)} /></td>
                        <td style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--fg-2,#334155)' }}>{ticket.serviceType ? `${ticket.serviceType} · ${ticket.serviceDetail}` : 'Sin clasificar'}</td>
                        <td style={{ padding: '13px 16px' }}><Stars value={ticket.rating || 0} onRate={canRate ? (value) => rate(ticket, value) : null} /></td>
                        {isAdmin && <td style={{ padding: '13px 16px', textAlign: 'right' }}><button onClick={() => openResolve(ticket)} disabled={ticket.status === 'resolved'} style={{ height: 34, padding: '0 12px', border: 'none', borderRadius: 9, background: ticket.status === 'resolved' ? 'var(--surface-3,#f1f3f6)' : 'var(--primary,#0f172a)', color: ticket.status === 'resolved' ? 'var(--muted,#64748b)' : 'var(--primary-fg,#fff)', fontWeight: 700, cursor: ticket.status === 'resolved' ? 'default' : 'pointer' }}>{ticket.status === 'resolved' ? 'Resuelto' : 'Resolver'}</button></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={curPage} totalPages={totalPages} total={total} start={total ? (curPage - 1) * PER + 1 : 0} end={Math.min(curPage * PER, total)} onPage={setPage} label="tickets" />
          </>
        ) : (
          <div style={{ padding: '70px 20px', textAlign: 'center', color: 'var(--muted,#64748b)' }}>{tickets.length ? 'No encontramos tickets que coincidan con los filtros aplicados.' : 'Todavía no hay tickets de Mesa de ayuda.'}{tickets.length ? <div style={{ marginTop: 16 }}><button onClick={clearFilters} style={{ height: 38, padding: '0 18px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Limpiar filtros</button></div> : null}</div>
        )}
      </div>

      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 18 }}>
          <form onSubmit={submitCreate} style={{ width: 'min(620px,100%)', background: 'var(--surface,#fff)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border,#e5e8ec)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontSize: 18, fontWeight: 800 }}>Nuevo ticket</div><div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 4 }}>Describe el servicio requerido y adjunta evidencia si aplica.</div></div><button type="button" onClick={closeCreate} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'var(--surface-2,#f7f8fa)', cursor: 'pointer' }}>×</button></div>
            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              {modalError && <div style={modalAlert}>{modalError}</div>}
              <div><label style={label}>Descripción del servicio requerido *</label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={3000} required style={input} /></div>
              <div><label style={label}>Adjunto opcional</label><input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setAttachment(event.target.files?.[0] || null)} style={{ fontSize: 13 }} />{preview && <img src={preview} alt="Vista previa" style={{ marginTop: 10, width: 160, maxHeight: 110, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border,#e5e8ec)' }} />}{attachment && !preview && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--muted,#64748b)' }}>{attachment.name}</div>}</div>
            </div>
            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" onClick={closeCreate} style={{ height: 38, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', borderRadius: 9, fontWeight: 700 }}>Cancelar</button><button type="submit" disabled={saving} style={{ height: 38, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 9, fontWeight: 800 }}>{saving ? 'Guardando…' : 'Crear ticket'}</button></div>
          </form>
        </div>
      )}

      {resolveTicket && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 18 }}>
          <form onSubmit={submitResolve} style={{ width: 'min(620px,100%)', background: 'var(--surface,#fff)', borderRadius: 16, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border,#e5e8ec)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontSize: 18, fontWeight: 800 }}>Resolver ticket #{resolveTicket.id}</div><div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 4 }}>Clasifica el servicio y deja observaciones para el solicitante.</div></div><button type="button" onClick={closeResolve} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'var(--surface-2,#f7f8fa)', cursor: 'pointer' }}>×</button></div>
            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              {modalError && <div style={modalAlert}>{modalError}</div>}
              <div><label style={label}>Tipo de servicio *</label><select value={resolveForm.serviceType} onChange={(event) => loadServiceDetails(event.target.value)} required style={input}><option value="">Seleccionar…</option>{serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
              <div><label style={label}>Detalle de servicio *</label><select value={resolveForm.serviceDetail} onChange={(event) => setResolveForm((current) => ({ ...current, serviceDetail: event.target.value }))} required disabled={!resolveForm.serviceType} style={input}><option value="">Seleccionar…</option>{serviceDetails.map((detail) => <option key={detail} value={detail}>{detail}</option>)}</select></div>
              <div><label style={label}>Observaciones administrativas *</label><textarea value={resolveForm.adminObservations} onChange={(event) => setResolveForm((current) => ({ ...current, adminObservations: event.target.value }))} rows={5} maxLength={3000} required style={input} /></div>
            </div>
            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" onClick={closeResolve} style={{ height: 38, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', borderRadius: 9, fontWeight: 700 }}>Cancelar</button><button type="submit" disabled={saving} style={{ height: 38, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 9, fontWeight: 800 }}>{saving ? 'Resolviendo…' : 'Resolver ticket'}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
