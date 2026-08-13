import { useEffect, useState, type CSSProperties } from 'react';
import { Icon } from '../lib/icons';
import { initials } from '../lib/format';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { TableSkeleton } from '../components/Skeletons';
import UserModal from '../components/UserModal';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const th: CSSProperties = { textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted,#64748b)', borderBottom: '1px solid var(--border,#e5e8ec)' };
const PER = 8;
const GRADS = ['linear-gradient(135deg,#22d3ee,#0891b2)', 'linear-gradient(135deg,#a78bfa,#7c3aed)', 'linear-gradient(135deg,#34d399,#059669)', 'linear-gradient(135deg,#fbbf24,#d97706)', 'linear-gradient(135deg,#fb7185,#e11d48)'];
const ROLE_COLORS = { Administrador: ['#7c3aed', 'rgba(124,58,237,.12)'], Editor: ['#0369a1', 'rgba(56,189,248,.14)'], Operador: ['#047857', 'rgba(16,185,129,.14)'], Consulta: ['#475569', 'rgba(148,163,184,.16)'] };

const ROLES = [
  { name: 'Administrador', count: 2, desc: 'Acceso total al sistema, configuración y gestión de usuarios.', perms: ['Todos los módulos', 'Configuración', 'Usuarios'], iconWrap: { background: 'rgba(124,58,237,.12)', color: '#7c3aed' } },
  { name: 'Editor', count: 4, desc: 'Crea y edita órdenes, cotizaciones y documentos.', perms: ['Órdenes', 'Cotizaciones', 'Documentos'], iconWrap: { background: 'rgba(56,189,248,.14)', color: '#0369a1' } },
  { name: 'Operador', count: 6, desc: 'Ejecuta tareas y actualiza el avance de las órdenes.', perms: ['Órdenes', 'Hojas de tiempo'], iconWrap: { background: 'rgba(16,185,129,.14)', color: '#047857' } },
  { name: 'Consulta', count: 9, desc: 'Acceso de solo lectura a reportes e indicadores.', perms: ['Solo lectura', 'Reportes'], iconWrap: { background: 'rgba(148,163,184,.16)', color: '#475569' } },
];

export default function Settings() {
  const [tab, setTab] = useState('usuarios');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getUsers()
      .then((rows) => { if (live) setUsers(rows); })
      .catch(() => { if (live) setUsers([]); })
      .finally(() => { if (live) setTimeout(() => setLoading(false), 500); });
    return () => { live = false; };
  }, []);

  const total = users.length;
  const totalPages = Math.max(1, Math.ceil(total / PER));
  const curPage = Math.min(page, totalPages);
  const slice = users.slice((curPage - 1) * PER, curPage * PER);

  const toggle = (gi) => setUsers((list) => list.map((x, i) => (i === gi ? { ...x, active: !x.active } : x)));

  const tabStyle = (active) => ({ padding: '11px 16px', border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: -1, color: active ? 'var(--fg,#0f172a)' : 'var(--muted,#64748b)', borderBottom: active ? '2px solid var(--brand,#0891b2)' : '2px solid transparent' });
  const roleStyle = (role) => { const m = ROLE_COLORS[role] || ROLE_COLORS.Consulta; return { display: 'inline-flex', padding: '3px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: m[0], background: m[1] }; };

  return (
    <>
      <PageHeader crumb="Sistema / Usuarios" title="Usuarios y roles" sub="Administra accesos, roles y permisos." primary={{ label: 'Nuevo usuario', onClick: () => setModal(true) }} />

      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border,#e5e8ec)' }}>
        <button onClick={() => setTab('usuarios')} style={tabStyle(tab === 'usuarios')}>Usuarios</button>
        <button onClick={() => setTab('roles')} style={tabStyle(tab === 'roles')}>Roles y permisos</button>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : tab === 'usuarios' ? (
        <div style={{ ...card, animation: 'scfade .3s ease' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2,#f7f8fa)' }}>
                  <th style={{ ...th, padding: '11px 18px' }}>Usuario</th>
                  <th style={th}>Rol</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Último acceso</th>
                  <th style={{ ...th, textAlign: 'right', padding: '11px 18px' }}></th>
                </tr>
              </thead>
              <tbody>
                {slice.map((u, idx) => {
                  const gi = (curPage - 1) * PER + idx;
                  const grad = GRADS[gi % 5];
                  return (
                    <tr key={u.email} style={{ borderBottom: '1px solid var(--border,#e5e8ec)', transition: 'background .12s' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2,#f7f8fa)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <span style={{ width: 36, height: 36, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, background: grad, color: '#fff' }}>{initials(u.name)}</span>
                          <div><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg,#0f172a)' }}>{u.name}</div><div style={{ fontSize: 12, color: 'var(--muted,#64748b)' }}>{u.email}</div></div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}><span style={roleStyle(u.role)}>{u.role}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => toggle(gi)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: u.active ? '#047857' : 'var(--muted,#64748b)' }}>
                          <span style={{ width: 34, height: 19, borderRadius: 11, padding: 2, display: 'inline-flex', transition: 'background .2s', background: u.active ? '#10b981' : 'var(--border-strong,#d5d9e0)' }}>
                            <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', transition: 'transform .2s', transform: u.active ? 'translateX(15px)' : 'translateX(0)' }} />
                          </span>
                          {u.active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--muted,#64748b)', fontFamily: 'JetBrains Mono,monospace' }}>{u.last}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button title="Editar" style={{ width: 30, height: 30, border: 'none', background: 'transparent', borderRadius: 8, color: 'var(--faint,#94a3b8)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" size={15} sw={1.9} /></button>
                          <button title="Eliminar" style={{ width: 30, height: 30, border: 'none', background: 'transparent', borderRadius: 8, color: 'var(--faint,#94a3b8)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" size={15} sw={1.9} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={curPage} totalPages={totalPages} total={total} start={total ? (curPage - 1) * PER + 1 : 0} end={Math.min(curPage * PER, total)} onPage={setPage} label="usuarios" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, animation: 'scfade .3s ease' }}>
          {ROLES.map((ro) => (
            <div key={ro.name} style={{ ...card, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', ...ro.iconWrap }}>
                  <Icon d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" size={19} sw={1.85} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted,#64748b)', background: 'var(--surface-3,#f1f3f6)', padding: '4px 10px', borderRadius: 8 }}>{ro.count} usuarios</span>
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--fg,#0f172a)', marginBottom: 4 }}>{ro.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted,#64748b)', lineHeight: 1.5, marginBottom: 14 }}>{ro.desc}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ro.perms.map((pm) => <span key={pm} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-2,#334155)', background: 'var(--surface-2,#f7f8fa)', border: '1px solid var(--border,#e5e8ec)', padding: '3px 9px', borderRadius: 7 }}>{pm}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <UserModal onClose={() => setModal(false)} />}
    </>
  );
}
