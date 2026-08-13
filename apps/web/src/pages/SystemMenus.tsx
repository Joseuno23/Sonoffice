import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { TableSkeleton } from '../components/Skeletons';
import { I, Icon } from '../lib/icons';
import { api } from '../services/api';

const emptyForm = {
  code: '',
  label: '',
  parentId: '',
  route: '',
  icon: '',
  sortOrder: 0,
  isActive: true,
};

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const input: CSSProperties = { width: '100%', height: 38, padding: '0 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none' };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--fg-2,#334155)', marginBottom: 6 };
const modalAlert: CSSProperties = { gridColumn: '1 / -1', padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: '#b91c1c', background: 'rgba(239,68,68,.10)', border: '1px solid rgba(239,68,68,.18)' };
const CHIPS = ['Todos', 'Activos', 'Inactivos'];
const PER = 8;
const ICON_OPTIONS = [
  { value: 'settings', label: 'Configuración' },
  { value: 'roles', label: 'Roles o grupos' },
  { value: 'menu', label: 'Menú' },
  { value: 'users', label: 'Usuarios' },
  { value: 'lock', label: 'Seguridad de acceso' },
  { value: 'key', label: 'Permisos' },
  { value: 'file', label: 'Documento' },
  { value: 'folder', label: 'Carpeta' },
  { value: 'contract', label: 'Contrato' },
  { value: 'receipt', label: 'Factura' },
  { value: 'factory', label: 'Producción' },
  { value: 'mail', label: 'Correo' },
  { value: 'shield', label: 'Seguridad' },
  { value: 'server', label: 'Servidor' },
  { value: 'database', label: 'Base de datos' },
  { value: 'clock', label: 'Tiempo' },
  { value: 'calendar', label: 'Calendario' },
  { value: 'chart', label: 'Indicadores' },
  { value: 'image', label: 'Imagen' },
  { value: 'tag', label: 'Etiqueta' },
  { value: 'map', label: 'Ubicación' },
  { value: 'bell', label: 'Notificaciones' },
  { value: 'clipboard', label: 'Lista de control' },
  { value: 'dash', label: 'Panel' },
];

function asArray(response) {
  if (Array.isArray(response)) return response;
  return response?.success ? response.data : [];
}

function toForm(menu) {
  return {
    code: menu.code ?? '',
    label: menu.label ?? '',
    parentId: menu.parentId ? String(menu.parentId) : '',
    route: menu.route ?? '',
    icon: menu.icon ?? '',
    sortOrder: menu.sortOrder ?? 0,
    isActive: !!menu.isActive,
  };
}

export default function SystemMenus() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Todos');
  const [page, setPage] = useState(1);
  const [menuAction, setMenuAction] = useState(null);

  const parentLabelById = useMemo(() => {
    const map = new Map();
    menus.forEach((menu) => map.set(menu.id, menu.label));
    return map;
  }, [menus]);

  const orderedMenus = useMemo(() => {
    let rows = [...menus];
    const term = q.trim().toLowerCase();

    if (term) {
      rows = rows.filter((menu) => [menu.label, menu.code, menu.route, menu.icon, menu.parentLabel, parentLabelById.get(menu.parentId)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)));
    }

    if (status !== 'Todos') rows = rows.filter((menu) => (status === 'Activos' ? menu.isActive : !menu.isActive));

    return rows.sort((a, b) => {
      const ap = a.parentId ?? 0;
      const bp = b.parentId ?? 0;
      if (ap !== bp) return ap - bp;
      if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      return String(a.label).localeCompare(String(b.label));
    });
  }, [menus, parentLabelById, q, status]);

  const total = orderedMenus.length;
  const totalPages = Math.max(1, Math.ceil(total / PER));
  const curPage = Math.min(page, totalPages);
  const pageRows = orderedMenus.slice((curPage - 1) * PER, curPage * PER);
  const selectedMenu = menuAction ? menus.find((menu) => menu.id === menuAction.id) : null;

  const loadMenus = () => {
    setLoading(true);
    return api.getSystemMenus()
      .then((response) => {
        setMenus(asArray(response));
        if (response?.success === false) setMessage({ type: 'error', text: response.message });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudieron cargar los menús.' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getSystemMenus()
      .then((response) => { if (live) setMenus(asArray(response)); })
      .catch(() => { if (live) setMessage({ type: 'error', text: 'No se pudieron cargar los menús.' }); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setModalError(null);
    setMessage(null);
    setModal({ mode: 'create', menu: null });
  };

  const openEdit = (menu) => {
    setForm(toForm(menu));
    setModalError(null);
    setMessage(null);
    setModal({ mode: 'edit', menu });
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

    const payload = {
      code: form.code,
      label: form.label,
      parentId: form.parentId ? Number(form.parentId) : null,
      route: form.route || null,
      icon: form.icon || null,
      sortOrder: Number(form.sortOrder || 0),
      isActive: form.isActive,
    };

    const request = modal?.mode === 'edit'
      ? api.updateSystemMenu(modal.menu.id, payload)
      : api.createSystemMenu(payload);

    request
      .then((response) => {
        if (response?.success === false) {
          setModalError(response.message || 'No se pudo guardar el menú.');
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Menú guardado correctamente.' });
        setModal(null);
        setForm(emptyForm);
        setModalError(null);
        loadMenus();
      })
      .catch(() => setModalError('No se pudo guardar el menú.'))
      .finally(() => setSaving(false));
  };

  const toggleStatus = (menu) => {
    setMessage(null);
    setMenuAction(null);
    api.updateSystemMenuStatus(menu.id, !menu.isActive)
      .then((response) => {
        if (response?.success === false) {
          setMessage({ type: 'error', text: response.message || 'No se pudo actualizar el estado.' });
          return;
        }
        setMessage({ type: 'success', text: response?.message || 'Estado actualizado correctamente.' });
        loadMenus();
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo actualizar el estado.' }));
  };

  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const availableParents = menus.filter((menu) => menu.id !== modal?.menu?.id);
  const clearFilters = () => { setQ(''); setStatus('Todos'); setPage(1); };
  const chipStyle = (active) => active
    ? { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', border: '1px solid var(--primary,#0f172a)' }
    : { height: 34, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'all .14s', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', border: '1px solid var(--border,#e5e8ec)' };
  const menuItemStyle = (color: string): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 11px', border: 'none', background: 'transparent', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background .12s', color });

  return (
    <>
      <PageHeader
        crumb="Sistema · Menús"
        title="Menús del sistema"
        sub="Administra las opciones visibles en la navegación."
        primary={{ label: 'Nuevo menú', onClick: openCreate }}
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
            <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Buscar por nombre, código, ruta o padre…" style={{ ...input, padding: '0 12px 0 36px' }} onFocus={(event) => { event.target.style.borderColor = 'var(--brand,#0891b2)'; event.target.style.boxShadow = '0 0 0 3px var(--brand-soft,#ecfeff)'; }} onBlur={(event) => { event.target.style.borderColor = 'var(--border,#e5e8ec)'; event.target.style.boxShadow = 'none'; }} />
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
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                  <th style={th}>Menú</th>
                  <th style={th}>Código</th>
                  <th style={th}>Padre</th>
                  <th style={th}>Ruta</th>
                  <th style={th}>Orden</th>
                  <th style={th}>Estado</th>
                  <th style={{ ...th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((menu) => (
                  <tr key={menu.id} style={{ borderBottom: '1px solid var(--border,#e5e8ec)', transition: 'background .12s' }} onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-3,#f1f3f6)', color: 'var(--fg-2,#334155)' }}>
                          <Icon d="M4 6h16M4 12h16M4 18h16" size={15} sw={1.9} />
                        </span>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>{menu.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted,#64748b)' }}>{menu.icon || 'Sin ícono'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5, color: 'var(--brand,#0891b2)', fontWeight: 700 }}>{menu.code}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{menu.parentLabel || parentLabelById.get(menu.parentId) || 'Raíz'}</td>
                    <td style={{ padding: '13px 16px', fontFamily: 'JetBrains Mono,monospace', fontSize: 12.5, color: 'var(--muted,#64748b)' }}>{menu.route || 'Contenedor'}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-2,#334155)' }}>{menu.sortOrder}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <button onClick={() => toggleStatus(menu)} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }} title={menu.isActive ? 'Desactivar menú' : 'Activar menú'}>
                        <Badge estado={menu.isActive ? 'Activo' : 'Inactivo'} />
                      </button>
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                      <button onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setMenuAction({ id: menu.id, x: rect.right, y: rect.bottom }); }} title="Acciones" aria-label="Acciones" style={{ width: 32, height: 32, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface,#fff)', borderRadius: 8, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'inline-grid', placeItems: 'center', transition: 'all .14s' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)'; e.currentTarget.style.color = 'var(--fg,#0f172a)'; e.currentTarget.style.borderColor = 'var(--border-strong,#d5d9e0)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface,#fff)'; e.currentTarget.style.color = 'var(--muted,#64748b)'; e.currentTarget.style.borderColor = 'var(--border,#e5e8ec)'; }}>
                        <Icon d="M12 6h.01M12 12h.01M12 18h.01" size={18} sw={2.5} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {menuAction && selectedMenu && (
            <>
              <div onClick={() => setMenuAction(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'fixed', top: menuAction.y + 6, right: window.innerWidth - menuAction.x, zIndex: 41, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, boxShadow: 'var(--shadow-lg,0 16px 40px -14px rgba(15,23,42,.2))', padding: 6, minWidth: 174, animation: 'scpop .16s ease' }}>
                <button onClick={() => { setMenuAction(null); openEdit(selectedMenu); }} style={menuItemStyle('var(--fg-2,#334155)')} onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}>
                  <Icon d={['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z']} size={16} sw={1.8} />Editar
                </button>
                <button onClick={() => toggleStatus(selectedMenu)} style={menuItemStyle(selectedMenu.isActive ? '#b45309' : '#047857')} onMouseEnter={(event) => (event.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(event) => (event.currentTarget.style.background = 'transparent')}>
                  <Icon d={selectedMenu.isActive ? 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z' : 'M20 6 9 17l-5-5'} size={16} sw={1.8} stroke={selectedMenu.isActive ? '#b45309' : '#047857'} />{selectedMenu.isActive ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </>
          )}
          <Pagination page={curPage} totalPages={totalPages} total={total} start={total ? (curPage - 1) * PER + 1 : 0} end={Math.min(curPage * PER, total)} onPage={setPage} label="menús" />
          </>
        ) : (
          <div style={{ padding: '70px 20px', textAlign: 'center', animation: 'scfade .3s ease' }}>
            <div style={{ width: 66, height: 66, borderRadius: 18, background: 'var(--surface-3,#f1f3f6)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', color: 'var(--faint,#94a3b8)' }}>
              <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-3.5-3.5" size={30} sw={1.6} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 6 }}>{menus.length ? 'Sin resultados' : 'Sin menús registrados'}</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted,#64748b)', maxWidth: 330, margin: '0 auto 20px' }}>{menus.length ? 'No encontramos menús que coincidan con los filtros aplicados. Ajusta tu búsqueda.' : 'Crea el primer menú para iniciar la administración.'}</div>
            {menus.length ? (
              <button onClick={clearFilters} style={{ height: 38, padding: '0 18px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Limpiar filtros</button>
            ) : (
              <button onClick={openCreate} style={{ height: 38, padding: '0 18px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Nuevo menú</button>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,.35)', display: 'grid', placeItems: 'center', padding: 18 }}>
          <form onSubmit={submit} style={{ width: 'min(720px,100%)', background: 'var(--surface,#fff)', borderRadius: 16, boxShadow: 'var(--shadow-lg,0 24px 60px -18px rgba(15,23,42,.35))', border: '1px solid var(--border,#e5e8ec)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>{modal.mode === 'edit' ? 'Editar menú' : 'Nuevo menú'}</div>
                <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', marginTop: 4 }}>Completa la información básica del menú.</div>
              </div>
              <button type="button" onClick={closeModal} style={{ width: 34, height: 34, border: 'none', borderRadius: 9, background: 'var(--surface-2,#f7f8fa)', color: 'var(--muted,#64748b)', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
              {modalError && <div style={modalAlert}>{modalError}</div>}
              <div>
                <label style={labelStyle}>Código *</label>
                <input value={form.code} onChange={(event) => field('code', event.target.value)} style={input} placeholder="system.menus" required />
              </div>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input value={form.label} onChange={(event) => field('label', event.target.value)} style={input} placeholder="Menús" required />
              </div>
              <div>
                <label style={labelStyle}>Menú padre</label>
                <select value={form.parentId} onChange={(event) => field('parentId', event.target.value)} style={input}>
                  <option value="">Raíz</option>
                  {availableParents.map((menu) => <option key={menu.id} value={menu.id}>{menu.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Ruta</label>
                <input value={form.route} onChange={(event) => field('route', event.target.value)} style={input} placeholder="/system/menus" />
              </div>
              <div>
                <label style={labelStyle}>Ícono</label>
                <div style={{ display: 'flex', gap: 9 }}>
                  <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg-2,#334155)', display: 'grid', placeItems: 'center' }}>
                    <Icon d={I[form.icon] || I.settings} size={17} />
                  </span>
                  <select value={form.icon || 'settings'} onChange={(event) => field('icon', event.target.value)} style={input}>
                    {ICON_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Orden</label>
                <input type="number" value={form.sortOrder} onChange={(event) => field('sortOrder', event.target.value)} style={input} />
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <button
                  type="button"
                  onClick={() => field('isActive', !form.isActive)}
                  style={{
                    height: 38,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 9,
                    border: '1px solid var(--border,#e5e8ec)',
                    background: 'var(--surface,#fff)',
                    color: form.isActive ? '#047857' : 'var(--muted,#64748b)',
                    borderRadius: 9,
                    padding: '0 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
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
    </>
  );
}
