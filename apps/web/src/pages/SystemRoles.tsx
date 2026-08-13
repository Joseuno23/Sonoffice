import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { TableSkeleton } from '../components/Skeletons';
import { Icon } from '../lib/icons';
import { api } from '../services/api';

const emptyForm = { description: '', isActive: true };
const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const input: CSSProperties = { width: '100%', height: 38, padding: '0 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none' };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--fg-2,#334155)', marginBottom: 6 };
const modalAlert: CSSProperties = { padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' };
const CHIPS = ['Todos', 'Activos', 'Inactivos'];
const PER = 8;
const ROOT_ROLE_ID = 1;
const ROOT_IMPLICIT_ACCESS_MESSAGE = 'El administrador principal tiene acceso total automáticamente.';

function asArray(response) {
  if (Array.isArray(response)) return response;
  return response?.success ? response.data : [];
}

function toForm(role) {
  return { description: role.description ?? '', isActive: !!role.isActive };
}

function buildMenuTree(menus) {
  const byId = new Map();
  const roots = [];

  menus.forEach((menu) => byId.set(menu.id, { ...menu, children: [] }));
  menus.forEach((menu) => {
    const item = byId.get(menu.id);
    const parent = menu.parentId ? byId.get(menu.parentId) : null;
    if (parent) parent.children.push(item);
    else roots.push(item);
  });

  return roots;
}

export default function SystemRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Todos');
  const [page, setPage] = useState(1);
  const [roleAction, setRoleAction] = useState(null);
  const [permissionModal, setPermissionModal] = useState(null);
  const [permissionMenus, setPermissionMenus] = useState([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState(new Set());
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  const orderedRoles = useMemo(() => {
    let rows = [...roles];
    const term = q.trim().toLowerCase();

    if (term) {
      rows = rows.filter((role) => String(role.description ?? '').toLowerCase().includes(term));
    }

    if (status !== 'Todos') rows = rows.filter((role) => (status === 'Activos' ? role.isActive : !role.isActive));
    return rows.sort((a, b) => String(a.description).localeCompare(String(b.description)) || a.id - b.id);
  }, [roles, q, status]);

  const total = orderedRoles.length;
  const totalPages = Math.max(1, Math.ceil(total / PER));
  const curPage = Math.min(page, totalPages);
  const pageRows = orderedRoles.slice((curPage - 1) * PER, curPage * PER);
  const selectedRole = roleAction ? roles.find((role) => role.id === roleAction.id) : null;
  const permissionMenuTree = useMemo(() => buildMenuTree(permissionMenus), [permissionMenus]);
  const isRootPermissionModal = permissionModal?.id === ROOT_ROLE_ID;

  const loadRoles = () => {
    setLoading(true);
    return api.getSystemRoles()
      .then((response) => {
        setRoles(asArray(response));
        if (response?.success === false) setMessage({ type: 'error', text: response.message });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudieron cargar los roles.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getSystemRoles()
      .then((response) => { if (live) setRoles(asArray(response)); })
      .catch(() => { if (live) setMessage({ type: 'error', text: 'No se pudieron cargar los roles.' }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setModalError(null);
    setMessage(null);
    setModal({ mode: 'create', role: null });
  };

  const openEdit = (role) => {
    setForm(toForm(role));
    setModalError(null);
    setMessage(null);
    setModal({ mode: 'edit', role });
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
    setForm(emptyForm);
    setModalError(null);
  };

  const submit = (event) => {
    event.preventDefault();
    setSaving(true);
    setModalError(null);

    const payload = { description: form.description, isActive: form.isActive };
    const request = modal?.mode === 'edit'
      ? api.updateSystemRole(modal.role.id, payload)
      : api.createSystemRole(payload);

    request
      .then((response) => {
        if (response?.success === false) {
          setModalError(response.message || 'No se pudo guardar el rol.');
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Rol guardado correctamente.' });
        setModal(null);
        setForm(emptyForm);
        setModalError(null);
        loadRoles();
      })
      .catch(() => setModalError('No se pudo guardar el rol.'))
      .finally(() => setSaving(false));
  };

  const toggleStatus = (role) => {
    setMessage(null);
    setRoleAction(null);
    api.updateSystemRoleStatus(role.id, !role.isActive)
      .then((response) => {
        if (response?.success === false) {
          setMessage({ type: 'error', text: response.message || 'No se pudo actualizar el estado.' });
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Estado actualizado correctamente.' });
        loadRoles();
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo actualizar el estado.' }));
  };

  const openMenuPermissions = (role) => {
    setRoleAction(null);
    setMessage(null);
    setPermissionModal(role);
    setPermissionMenus([]);
    setSelectedMenuIds(new Set());
    setPermissionError(null);
    setPermissionsLoading(true);

    api.getSystemRoleMenuPermissions(role.id)
      .then((response) => {
        if (response?.success === false) {
          setMessage({ type: 'error', text: response.message || 'No se pudieron cargar los permisos de menú.' });
          setPermissionModal(null);
          return;
        }

        const menus = Array.isArray(response?.data?.menus) ? response.data.menus : [];
        setPermissionMenus(menus);
        setSelectedMenuIds(new Set(menus.filter((menu) => menu.canView).map((menu) => menu.id)));
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'No se pudieron cargar los permisos de menú.' });
        setPermissionModal(null);
      })
      .finally(() => setPermissionsLoading(false));
  };

  const closePermissionModal = () => {
    if (permissionsSaving) return;
    setPermissionModal(null);
    setPermissionMenus([]);
    setSelectedMenuIds(new Set());
    setPermissionError(null);
  };

  const toggleMenuPermission = (menu) => {
    if (isRootPermissionModal) return;

    setSelectedMenuIds((current) => {
      const next = new Set(current);
      if (next.has(menu.id)) next.delete(menu.id);
      else next.add(menu.id);
      return next;
    });
  };

  const saveMenuPermissions = () => {
    if (!permissionModal) return;
    if (permissionModal.id === ROOT_ROLE_ID) {
      setMessage({ type: 'success', text: ROOT_IMPLICIT_ACCESS_MESSAGE });
      closePermissionModal();
      return;
    }

    setPermissionsSaving(true);
    setPermissionError(null);

    api.updateSystemRoleMenuPermissions(permissionModal.id, Array.from(selectedMenuIds))
      .then((response) => {
        if (response?.success === false) {
          setPermissionError(response.message || 'No se pudieron guardar los permisos de menú.');
          return;
        }

        setMessage({ type: 'success', text: response?.message || 'Permisos de menú actualizados correctamente.' });
        closePermissionModal();
        loadRoles();
      })
      .catch(() => setPermissionError('No se pudieron guardar los permisos de menú.'))
      .finally(() => setPermissionsSaving(false));
  };

  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const clearFilters = () => { setQ(''); setStatus('Todos'); setPage(1); };
  const chipStyle = (active) => active
    ? { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', border: '1px solid var(--primary,#0f172a)' }
    : { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', border: '1px solid var(--border,#e5e8ec)' };
  const menuItemStyle = (color: string): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background .12s', color });
  const renderPermissionMenu = (menu, level = 0) => {
    const checked = isRootPermissionModal || selectedMenuIds.has(menu.id);
    const disabled = isRootPermissionModal;

    return (
      <div key={menu.id}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 38, padding: `7px 10px 7px ${10 + level * 22}px`, borderRadius: 10, color: disabled ? 'var(--muted,#64748b)' : 'var(--fg-2,#334155)', background: checked ? 'rgba(8,145,178,.07)' : 'transparent', cursor: disabled ? 'not-allowed' : 'pointer' }}>
          <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleMenuPermission(menu)} style={{ width: 16, height: 16, accentColor: 'var(--brand,#0891b2)' }} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{menu.label}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted,#64748b)' }}>{menu.code}{menu.route ? ` · ${menu.route}` : ''}</span>
          </span>
          {disabled && <span style={{ fontSize: 11, fontWeight: 700, color: '#047857' }}>Acceso total</span>}
        </label>
        {menu.children?.map((child) => renderPermissionMenu(child, level + 1))}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        crumb="Sistema · Roles"
        title="Roles del sistema"
        sub="Administra los perfiles de acceso disponibles."
        primary={{ label: 'Nuevo rol', onClick: openCreate }}
      />

      {message && (
        <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: message.type === 'error' ? '#b91c1c' : '#047857', background: message.type === 'error' ? 'rgba(239,68,68,.10)' : 'rgba(16,185,129,.12)', border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,.18)' : 'rgba(16,185,129,.18)'}` }}>
          {message.text}
        </div>
      )}

      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}>
              <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5" size={15} sw={2} />
            </span>
            <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Buscar por descripción…" style={{ ...input, padding: '0 12px 0 36px' }} onFocus={(event) => { event.target.style.borderColor = 'var(--brand,#0891b2)'; event.target.style.boxShadow = '0 0 0 3px var(--brand-soft,#ecfeff)'; }} onBlur={(event) => { event.target.style.borderColor = 'var(--border,#e5e8ec)'; event.target.style.boxShadow = 'none'; }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CHIPS.map((chip) => (
              <button key={chip} onClick={() => { setStatus(chip); setPage(1); }} style={chipStyle(status === chip)}>{chip}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <TableSkeleton />
        ) : total > 0 ? (
          <>
            <div style={{ overflowX: 'auto', animation: 'scfade .3s ease' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                    <th style={th}>Rol</th>
                    <th style={th}>Usuarios</th>
                    <th style={th}>Permisos de menú</th>
                    <th style={th}>Última actualización</th>
                    <th style={th}>Estado</th>
                    <th style={{ ...th, textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((role) => (
                    <tr key={role.id} style={{ borderBottom: '1px solid var(--border,#e5e8ec)', transition: 'background .12s' }} onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-3,#f1f3f6)', color: 'var(--fg-2,#334155)' }}>
                            <Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6" size={15} sw={1.8} />
                          </span>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>{role.description}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted,#64748b)' }}>ID {role.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{role.usersCount ?? 0}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{role.appMenuPermissionsCount ?? 0}</td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--muted,#64748b)' }}>{role.lastUpdate ? new Date(role.lastUpdate).toLocaleString('es-CO') : 'Sin registro'}</td>
                      <td style={{ padding: '13px 16px' }}>
                        <button disabled={role.id === 1} onClick={() => toggleStatus(role)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: role.id === 1 ? 'default' : 'pointer', opacity: role.id === 1 ? 0.85 : 1 }} title={role.id === 1 ? 'Rol administrador principal' : role.isActive ? 'Desactivar rol' : 'Activar rol'}>
                          <Badge estado={role.isActive ? 'Activo' : 'Inactivo'} />
                        </button>
                      </td>
                      <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                        <button onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setRoleAction({ id: role.id, x: rect.right, y: rect.bottom }); }} title="Acciones" aria-label="Acciones" style={{ width: 32, height: 32, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', borderRadius: 8, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', transition: 'all .14s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)'; e.currentTarget.style.color = 'var(--fg,#0f172a)'; e.currentTarget.style.borderColor = 'var(--border-strong,#d5d9e0)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface,#fff)'; e.currentTarget.style.color = 'var(--muted,#64748b)'; e.currentTarget.style.borderColor = 'var(--border,#e5e8ec)'; }}>
                          <Icon d="M12 6h.01M12 12h.01M12 18h.01" size={18} sw={2.5} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {roleAction && selectedRole && (
              <>
                <div onClick={() => setRoleAction(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'fixed', top: roleAction.y + 6, right: window.innerWidth - roleAction.x, zIndex: 41, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, boxShadow: 'var(--shadow-lg,0 16px 40px -14px rgba(15,23,42,.2))', padding: 6, minWidth: 174, animation: 'scpop .16s ease' }}>
                  <button onClick={() => { setRoleAction(null); openEdit(selectedRole); }} style={menuItemStyle('var(--fg-2,#334155)')} onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}>
                    <Icon d={['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z']} size={16} sw={1.8} />Editar
                  </button>
                  <button onClick={() => openMenuPermissions(selectedRole)} style={menuItemStyle('var(--fg-2,#334155)')} onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}>
                    <Icon d={['M9 12l2 2 4-4', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z']} size={16} sw={1.8} />Permisos de menú
                  </button>
                  {selectedRole.id !== 1 && (
                    <button onClick={() => toggleStatus(selectedRole)} style={menuItemStyle(selectedRole.isActive ? '#b45309' : '#047857')} onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}>
                      <Icon d={selectedRole.isActive ? 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z' : 'M20 6 9 17l-5-5'} size={16} sw={1.8} stroke={selectedRole.isActive ? '#b45309' : '#047857'} />{selectedRole.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              </>
            )}
            <Pagination page={curPage} totalPages={totalPages} total={total} start={total ? (curPage - 1) * PER + 1 : 0} end={Math.min(curPage * PER, total)} onPage={setPage} label="roles" />
          </>
        ) : (
          <div style={{ padding: '70px 20px', textAlign: 'center', animation: 'scfade .3s ease' }}>
            <div style={{ width: 66, height: 66, borderRadius: 18, background: 'var(--surface-3,#f1f3f6)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', color: 'var(--faint,#94a3b8)' }}>
              <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5" size={30} sw={1.6} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 6 }}>{roles.length ? 'Sin resultados' : 'Sin roles registrados'}</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted,#64748b)', maxWidth: 330, margin: '0 auto 20px' }}>{roles.length ? 'No encontramos roles que coincidan con los filtros aplicados. Ajusta tu búsqueda.' : 'Crea el primer rol para iniciar la administración.'}</div>
            {roles.length ? (
              <button onClick={clearFilters} style={{ height: 38, padding: '0 18px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Limpiar filtros</button>
            ) : (
              <button onClick={openCreate} style={{ height: 38, padding: '0 18px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Nuevo rol</button>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 18 }}>
          <form onSubmit={submit} style={{ width: 'min(560px,100%)', background: 'var(--surface,#fff)', borderRadius: 16, boxShadow: 'var(--shadow-lg,0 24px 60px -18px rgba(15,23,42,.35))', border: '1px solid var(--border,#e5e8ec)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>{modal.mode === 'edit' ? 'Editar rol' : 'Nuevo rol'}</div>
                <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 4 }}>Completa la información básica del rol.</div>
              </div>
              <button type="button" onClick={closeModal} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'var(--surface-2,#f7f8fa)', color: 'var(--muted,#64748b)', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: 20, display: 'grid', gap: 14 }}>
              {modalError && <div style={modalAlert}>{modalError}</div>}
              <div>
                <label style={labelStyle}>Descripción *</label>
                <input value={form.description} onChange={(event) => field('description', event.target.value)} maxLength={50} style={input} placeholder="ADMINISTRADOR" required />
                <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--muted,#64748b)' }}>Se guardará en mayúsculas. Máximo 50 caracteres.</div>
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <button type="button" onClick={() => field('isActive', !form.isActive)} style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', color: form.isActive ? '#047857' : 'var(--muted,#64748b)', borderRadius: 9, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <span style={{ width: 34, height: 19, borderRadius: 11, padding: 2, display: 'inline-flex', background: form.isActive ? '#10b981' : 'var(--border-strong,#d5d9e0)' }}>
                    <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', transform: form.isActive ? 'translateX(15px)' : 'translateX(0)', transition: 'transform .14s' }} />
                  </span>
                  {form.isActive ? 'Activo' : 'Inactivo'}
                </button>
              </div>
            </div>
            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={closeModal} style={{ height: 38, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ height: 38, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .75 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {permissionModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 18 }}>
          <div style={{ width: 'min(680px,100%)', maxHeight: 'min(760px,calc(100vh - 36px))', background: 'var(--surface,#fff)', borderRadius: 16, boxShadow: 'var(--shadow-lg,0 24px 60px -18px rgba(15,23,42,.35))', border: '1px solid var(--border,#e5e8ec)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>Permisos de menú</div>
                <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 4 }}>{isRootPermissionModal ? ROOT_IMPLICIT_ACCESS_MESSAGE : `Selecciona los menús visibles para ${permissionModal.description}.`}</div>
              </div>
              <button type="button" onClick={closePermissionModal} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'var(--surface-2,#f7f8fa)', color: 'var(--muted,#64748b)', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: 20, overflowY: 'auto' }}>
              {permissionError && <div style={{ ...modalAlert, marginBottom: 12 }}>{permissionError}</div>}
              {permissionModal.id === ROOT_ROLE_ID && (
                <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#047857', background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.18)' }}>
                  {ROOT_IMPLICIT_ACCESS_MESSAGE} No requiere asignaciones manuales de permisos.
                </div>
              )}
              {permissionsLoading ? (
                <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--muted,#64748b)', fontSize: 13 }}>Cargando permisos…</div>
              ) : permissionMenus.length ? (
                <div style={{ display: 'grid', gap: 4 }}>{permissionMenuTree.map((menu) => renderPermissionMenu(menu))}</div>
              ) : (
                <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--muted,#64748b)', fontSize: 13 }}>No hay menús activos disponibles.</div>
              )}
            </div>

            <div style={{ padding: '15px 20px', borderTop: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)' }}>{selectedMenuIds.size} menús seleccionados</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={closePermissionModal} style={{ height: 38, padding: '0 15px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                <button type="button" disabled={isRootPermissionModal || permissionsLoading || permissionsSaving} onClick={saveMenuPermissions} style={{ height: 38, padding: '0 17px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 9, fontWeight: 800, fontSize: 13, cursor: isRootPermissionModal ? 'not-allowed' : permissionsSaving ? 'wait' : 'pointer', opacity: isRootPermissionModal || permissionsLoading || permissionsSaving ? .75 : 1 }}>{permissionsSaving ? 'Guardando…' : 'Guardar permisos'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
