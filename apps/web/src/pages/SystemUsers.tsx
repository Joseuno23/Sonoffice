import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { useAuth } from '../auth/AuthContext';
import { TableSkeleton } from '../components/Skeletons';
import { Icon } from '../lib/icons';
import { api, assetUrl } from '../services/api';

const emptyForm = { name: '', cc: '', areaId: '', username: '', email: '', roleId: '', admissionDate: '', timeSheets: false, avatar: '', isActive: true };
const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const input: CSSProperties = { width: '100%', height: 38, padding: '0 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none' };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--fg-2,#334155)', marginBottom: 6 };
const modalAlert: CSSProperties = { gridColumn: '1 / -1', padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' };
const CHIPS = ['Todos', 'Activos', 'Inactivos'];
const PER = 8;

const avatarBox: CSSProperties = { width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-3,#f1f3f6)', color: 'var(--fg-2,#334155)', overflow: 'hidden', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' };

function asArray(response) {
  if (Array.isArray(response)) return response;
  return response?.success ? response.data : [];
}

function asOptions(response) {
  return response?.success ? response.data : { roles: [], areas: [], avatars: [] };
}

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function toForm(user) {
  return {
    name: user.name ?? '',
    cc: user.cc ?? '',
    areaId: user.areaId ? String(user.areaId) : '',
    username: user.username ?? '',
    email: user.email ?? '',
    roleId: user.roleId ? String(user.roleId) : '',
    admissionDate: toDateInput(user.admissionDate),
    timeSheets: Number(user.timeSheets ?? 0) === 1,
    avatar: user.avatar ?? '',
    isActive: !!user.isActive,
  };
}

function initials(name) {
  return String(name || 'U').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
}

function userAvatarUrl(user) {
  if (user?.avatarUrl) return assetUrl(user.avatarUrl);
  if (user?.avatar && /^[A-Za-z0-9._-]+$/.test(user.avatar)) return assetUrl(`/uploads/avatars/${encodeURIComponent(user.avatar)}`);
  return null;
}

function UserAvatar({ user, size = 30 }) {
  const src = userAvatarUrl(user);
  const [broken, setBroken] = useState(false);

  useEffect(() => { setBroken(false); }, [src]);

  return (
    <span style={{ ...avatarBox, width: size, height: size, borderRadius: size > 40 ? 14 : 9 }}>
      {src && !broken ? <img src={src} alt={`Avatar de ${user.name || 'usuario'}`} onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(user.name)}
    </span>
  );
}

export default function SystemUsers() {
  const { user: authUser, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState({ roles: [], areas: [], avatars: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [message, setMessage] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Activos');
  const [page, setPage] = useState(1);
  const [userAction, setUserAction] = useState(null);

  const orderedUsers = useMemo(() => {
    let rows = [...users];
    const term = q.trim().toLowerCase();
    if (term) {
      rows = rows.filter((user) => [user.name, user.cc, user.username, user.email, user.roleLabel, user.areaLabel]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)));
    }
    if (status !== 'Todos') rows = rows.filter((user) => (status === 'Activos' ? user.isActive : !user.isActive));
    return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.id - b.id);
  }, [users, q, status]);

  const total = orderedUsers.length;
  const totalPages = Math.max(1, Math.ceil(total / PER));
  const curPage = Math.min(page, totalPages);
  const pageRows = orderedUsers.slice((curPage - 1) * PER, curPage * PER);
  const selectedUser = userAction ? users.find((user) => user.id === userAction.id) : null;

  const loadUsers = () => {
    setLoading(true);
    return api.getSystemUsers()
      .then((response) => {
        setUsers(asArray(response));
        if (response?.success === false) setMessage({ type: 'error', text: response.message });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudieron cargar los usuarios.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    Promise.all([api.getSystemUsers(), api.getSystemUserOptions()])
      .then(([usersResponse, optionsResponse]) => {
        if (!live) return;
        setUsers(asArray(usersResponse));
        setOptions(asOptions(optionsResponse));
      })
      .catch(() => { if (live) setMessage({ type: 'error', text: 'No se pudieron cargar los usuarios.' }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  const clearAvatarSelection = () => {
    setAvatarFile(null);
    setAvatarPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const openCreate = () => { setForm(emptyForm); clearAvatarSelection(); setModalError(null); setMessage(null); setModal({ mode: 'create', user: null }); };
  const openEdit = (user) => { setForm(toForm(user)); clearAvatarSelection(); setModalError(null); setMessage(null); setModal({ mode: 'edit', user }); };
  const closeModal = () => { if (!saving) { setModal(null); setForm(emptyForm); setModalError(null); clearAvatarSelection(); } };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setModalError(null);
    const payload = {
      name: form.name,
      cc: form.cc,
      areaId: form.areaId,
      username: form.username,
      email: form.email,
      roleId: form.roleId ? Number(form.roleId) : null,
      admissionDate: form.admissionDate || null,
      timeSheets: form.timeSheets,
      isActive: form.isActive,
    };
    const request = modal?.mode === 'edit' ? api.updateSystemUser(modal.user.id, payload) : api.createSystemUser(payload);
    try {
      const response = await request;
      if (response?.success === false) {
        setModalError(response.message || 'No se pudo guardar el usuario.');
        return;
      }

      const userId = response?.data?.id || modal?.user?.id;
      if (avatarFile && userId) {
        const avatarResponse = await api.uploadSystemUserAvatar(userId, avatarFile);
        if (avatarResponse?.success === false) {
          setModalError(avatarResponse.message || 'No se pudo cargar el avatar.');
          return;
        }
        if (Number(authUser?.id) === Number(userId)) {
          updateUser?.({
            name: avatarResponse.data?.name ?? authUser.name,
            avatar: avatarResponse.data?.avatar ?? null,
            avatarUrl: avatarResponse.data?.avatarUrl ?? null,
          });
        }
      } else if (Number(authUser?.id) === Number(userId)) {
        updateUser?.({ name: response?.data?.name ?? authUser.name });
      }

      setMessage({ type: 'success', text: response?.message || 'Usuario guardado correctamente.' });
      setModal(null);
      setForm(emptyForm);
      setModalError(null);
      clearAvatarSelection();
      loadUsers();
    } catch {
      setModalError('No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (user) => {
    setMessage(null);
    setUserAction(null);
    api.updateSystemUserStatus(user.id, !user.isActive)
      .then((response) => {
        if (response?.success === false) {
          setMessage({ type: 'error', text: response.message || 'No se pudo actualizar el estado.' });
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Estado actualizado correctamente.' });
        loadUsers();
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo actualizar el estado.' }));
  };

  const resetPassword = (user) => {
    setUserAction(null);
    if (!window.confirm(`¿Restablecer la contraseña de ${user.name}? La contraseña temporal será la definida por el sistema y deberá cambiarla al ingresar.`)) return;
    setMessage(null);
    api.resetSystemUserPassword(user.id)
      .then((response) => {
        if (response?.success === false) {
          setMessage({ type: 'error', text: response.message || 'No se pudo restablecer la contraseña.' });
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Contraseña restablecida correctamente.' });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo restablecer la contraseña.' }));
  };

  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectAvatar = (file) => {
    clearAvatarSelection();
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };
  const clearFilters = () => { setQ(''); setStatus('Activos'); setPage(1); };
  const chipStyle = (active) => active
    ? { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', border: '1px solid var(--primary,#0f172a)' }
    : { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', border: '1px solid var(--border,#e5e8ec)' };
  const menuItemStyle = (color: string): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background .12s', color });

  return (
    <>
      <PageHeader crumb="Sistema · Usuarios" title="Usuarios del sistema" sub="Administra cuentas, roles, áreas y estados de acceso." primary={{ label: 'Nuevo usuario', onClick: openCreate }} />

      {message && <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: message.type === 'error' ? '#b91c1c' : '#047857', background: message.type === 'error' ? 'rgba(239,68,68,.10)' : 'rgba(16,185,129,.12)', border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,.18)' : 'rgba(16,185,129,.18)'}` }}>{message.text}</div>}

      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}><Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5" size={15} sw={2} /></span>
            <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Buscar por nombre, documento, usuario, correo, rol o área…" style={{ ...input, padding: '0 12px 0 36px' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{CHIPS.map((chip) => <button key={chip} onClick={() => { setStatus(chip); setPage(1); }} style={chipStyle(status === chip)}>{chip}</button>)}</div>
        </div>

        {loading ? <TableSkeleton /> : total > 0 ? (
          <>
            <div style={{ overflowX: 'auto', animation: 'scfade .3s ease' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1020 }}>
                <thead><tr style={{ background: 'var(--surface-2,#f7f8fa)' }}><th style={th}>Usuario</th><th style={th}>Documento</th><th style={th}>Rol</th><th style={th}>Área</th><th style={th}>Ingreso</th><th style={th}>Tiempos</th><th style={th}>Estado</th><th style={{ ...th, textAlign: 'right' }}>Acciones</th></tr></thead>
                <tbody>{pageRows.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border,#e5e8ec)', transition: 'background .12s' }} onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '13px 16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><UserAvatar user={user} /><div><div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>{user.name}</div><div style={{ fontSize: 12, color: 'var(--muted,#64748b)' }}>{user.email}</div></div></div></td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{user.cc || 'Sin registro'}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{user.roleLabel || 'Sin rol'}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{user.areaLabel || 'Sin área'}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--muted,#64748b)' }}>{user.admissionDate ? new Date(user.admissionDate).toLocaleDateString('es-CO') : 'Sin registro'}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{Number(user.timeSheets ?? 0) === 1 ? 'Sí' : 'No'}</td>
                    <td style={{ padding: '13px 16px' }}><button onClick={() => toggleStatus(user)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}><Badge estado={user.isActive ? 'Activo' : 'Inactivo'} /></button></td>
                    <td style={{ padding: '13px 16px', textAlign: 'right' }}><button onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setUserAction({ id: user.id, x: rect.right, y: rect.bottom }); }} title="Acciones" aria-label="Acciones" style={{ width: 32, height: 32, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', borderRadius: 8, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', transition: 'all .14s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)'; e.currentTarget.style.color = 'var(--fg,#0f172a)'; e.currentTarget.style.borderColor = 'var(--border-strong,#d5d9e0)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface,#fff)'; e.currentTarget.style.color = 'var(--muted,#64748b)'; e.currentTarget.style.borderColor = 'var(--border,#e5e8ec)'; }}><Icon d="M12 6h.01M12 12h.01M12 18h.01" size={18} sw={2.5} /></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {userAction && selectedUser && <><div onClick={() => setUserAction(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} /><div style={{ position: 'fixed', top: userAction.y + 6, right: window.innerWidth - userAction.x, zIndex: 41, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, boxShadow: 'var(--shadow-lg,0 16px 40px -14px rgba(15,23,42,.2))', padding: 6, minWidth: 210, animation: 'scpop .16s ease' }}>
              <button onClick={() => { setUserAction(null); openEdit(selectedUser); }} style={menuItemStyle('var(--fg-2,#334155)')}><Icon d={['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z']} size={16} sw={1.8} />Editar</button>
              <button onClick={() => resetPassword(selectedUser)} style={menuItemStyle('#b45309')}><Icon d="M15 7a2 2 0 1 1 2 2l-7 7H7v-3zM9 14l2 2" size={16} sw={1.8} stroke="#b45309" />Restablecer contraseña</button>
              <button onClick={() => toggleStatus(selectedUser)} style={menuItemStyle(selectedUser.isActive ? '#b45309' : '#047857')}><Icon d={selectedUser.isActive ? 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z' : 'M20 6 9 17l-5-5'} size={16} sw={1.8} stroke={selectedUser.isActive ? '#b45309' : '#047857'} />{selectedUser.isActive ? 'Desactivar' : 'Activar'}</button>
            </div></>}
            <Pagination page={curPage} totalPages={totalPages} total={total} start={total ? (curPage - 1) * PER + 1 : 0} end={Math.min(curPage * PER, total)} onPage={setPage} label="usuarios" />
          </>
        ) : (
          <div style={{ padding: '70px 20px', textAlign: 'center', animation: 'scfade .3s ease' }}><div style={{ width: 66, height: 66, borderRadius: 18, background: 'var(--surface-3,#f1f3f6)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', color: 'var(--faint,#94a3b8)' }}><Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5" size={30} sw={1.6} /></div><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 6 }}>{users.length ? 'Sin resultados' : 'Sin usuarios registrados'}</div><div style={{ fontSize: 13.5, color: 'var(--muted,#64748b)', maxWidth: 330, margin: '0 auto 20px' }}>{users.length ? 'No encontramos usuarios que coincidan con los filtros aplicados. Ajusta tu búsqueda.' : 'Crea el primer usuario para iniciar la administración.'}</div>{users.length ? <button onClick={clearFilters} style={{ height: 38, padding: '0 18px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Limpiar filtros</button> : <button onClick={openCreate} style={{ height: 38, padding: '0 18px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Nuevo usuario</button>}</div>
        )}
      </div>

      {modal && <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 18 }}>
        <form onSubmit={submit} style={{ width: 'min(780px,100%)', background: 'var(--surface,#fff)', borderRadius: 16, boxShadow: 'var(--shadow-lg,0 24px 60px -18px rgba(15,23,42,.35))', border: '1px solid var(--border,#e5e8ec)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>{modal.mode === 'edit' ? 'Editar usuario' : 'Nuevo usuario'}</div><div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 4 }}>{modal.mode === 'edit' ? 'Actualiza solo los datos administrativos del usuario.' : 'La contraseña inicial será asignada por el sistema y deberá cambiarla al ingresar.'}</div></div><button type="button" onClick={closeModal} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'var(--surface-2,#f7f8fa)', color: 'var(--muted,#64748b)', cursor: 'pointer' }}>×</button></div>
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {modalError && <div style={modalAlert}>{modalError}</div>}
            <div><label style={labelStyle}>Nombre *</label><input value={form.name} onChange={(event) => field('name', event.target.value)} maxLength={50} style={input} required /></div>
            <div><label style={labelStyle}>Documento *</label><input value={form.cc} onChange={(event) => field('cc', event.target.value)} maxLength={50} style={input} required /></div>
            <div><label style={labelStyle}>Usuario *</label><input value={form.username} onChange={(event) => field('username', event.target.value)} maxLength={50} style={input} required /></div>
            <div><label style={labelStyle}>Correo *</label><input type="email" value={form.email} onChange={(event) => field('email', event.target.value)} maxLength={50} style={input} required /></div>
            <div><label style={labelStyle}>Rol *</label><select value={form.roleId} onChange={(event) => field('roleId', event.target.value)} style={input} required><option value="">Selecciona un rol</option>{options.roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></div>
            <div><label style={labelStyle}>Área *</label><select value={form.areaId} onChange={(event) => field('areaId', event.target.value)} style={input} required><option value="">Selecciona un área</option>{options.areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></div>
            <div><label style={labelStyle}>Fecha de ingreso</label><input type="date" value={form.admissionDate} onChange={(event) => field('admissionDate', event.target.value)} style={input} /></div>
            <div><label style={labelStyle}>Avatar</label><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ ...avatarBox, width: 46, height: 46, borderRadius: 14 }}>{avatarPreview ? <img src={avatarPreview} alt="Vista previa del avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : modal?.user ? <UserAvatar user={modal.user} size={46} /> : initials(form.name)}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => selectAvatar(event.target.files?.[0])} style={{ ...input, paddingTop: 8 }} /></div><div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--muted,#64748b)' }}>JPG, PNG, WebP o GIF. Máximo 2 MB.</div></div>
            <div><label style={labelStyle}>Reporta tiempos</label><button type="button" onClick={() => field('timeSheets', !form.timeSheets)} style={{ height: 38, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', color: form.timeSheets ? '#047857' : 'var(--muted,#64748b)', borderRadius: 9, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{form.timeSheets ? 'Sí' : 'No'}</button></div>
            <div><label style={labelStyle}>Estado</label><button type="button" onClick={() => field('isActive', !form.isActive)} style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', color: form.isActive ? '#047857' : 'var(--muted,#64748b)', borderRadius: 9, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}><span style={{ width: 34, height: 19, borderRadius: 11, padding: 2, display: 'inline-flex', background: form.isActive ? '#10b981' : 'var(--border-strong,#d5d9e0)' }}><span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', transform: form.isActive ? 'translateX(15px)' : 'translateX(0)', transition: 'transform .14s' }} /></span>{form.isActive ? 'Activo' : 'Inactivo'}</button></div>
          </div>
          <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" onClick={closeModal} style={{ height: 38, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button><button type="submit" disabled={saving} style={{ height: 38, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .75 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
        </form>
      </div>}
    </>
  );
}
