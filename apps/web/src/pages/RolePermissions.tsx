import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import PageHeader from '../components/PageHeader';
import { Icon } from '../lib/icons';
import { api } from '../services/api';

const card: CSSProperties = { background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 16, boxShadow: 'var(--shadow)', overflow: 'hidden' };
const input: CSSProperties = { width: '100%', minHeight: 38, padding: '9px 11px', borderRadius: 9, border: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const ROOT_ROLE_ID = 1;

interface Role { id: number; description: string; isActive: boolean; }
interface MenuPerm { id: number; code: string; label: string; parentId: number | null; route: string | null; canView: boolean; }
interface ActionItem { id: number; code: string; label: string; granted: boolean; }
interface ActionModule { moduleCode: string; actions: ActionItem[]; }

const MODULE_LABELS: Record<string, string> = {
  'cost-orders': 'Órdenes de costo',
};
const moduleLabel = (code: string) => MODULE_LABELS[code] || code;

function Checkbox({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 20, height: 20, flex: 'none', borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
        border: `1.5px solid ${checked ? 'var(--brand,#0891b2)' : 'var(--border-strong,#d5d9e0)'}`,
        background: checked ? 'var(--brand,#0891b2)' : 'var(--surface,#fff)',
        display: 'grid', placeItems: 'center', transition: 'all .14s', opacity: disabled ? 0.55 : 1,
      }}
    >
      {checked && <Icon d="M20 6L9 17l-5-5" size={13} sw={3} />}
    </button>
  );
}

export default function RolePermissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleSearch, setRoleSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<'views' | 'actions'>('views');

  const [menus, setMenus] = useState<MenuPerm[]>([]);
  const [menuChecked, setMenuChecked] = useState<Set<number>>(new Set());
  const [modules, setModules] = useState<ActionModule[]>([]);
  const [actionChecked, setActionChecked] = useState<Set<number>>(new Set());
  const [implicitFull, setImplicitFull] = useState(false);

  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isRoot = selectedRole?.id === ROOT_ROLE_ID;

  useEffect(() => {
    api.getSystemRoles()
      .then((res) => { if (res?.success) setRoles((res.data || []).map((r: any) => ({ id: r.id, description: r.description, isActive: r.isActive }))); })
      .catch(() => setRoles([]));
  }, []);

  const filteredRoles = useMemo(() => {
    const term = roleSearch.trim().toLowerCase();
    return term ? roles.filter((r) => r.description.toLowerCase().includes(term)) : roles;
  }, [roles, roleSearch]);

  const loadPermissions = (role: Role) => {
    setSelectedRole(role);
    setMessage(null);
    setLoadingPerms(true);
    Promise.all([api.getSystemRoleMenuPermissions(role.id), api.getSystemRoleActionPermissions(role.id)])
      .then(([menuRes, actionRes]) => {
        if (menuRes?.success) {
          const list: MenuPerm[] = menuRes.data.menus || [];
          setMenus(list);
          setMenuChecked(new Set(list.filter((m) => m.canView).map((m) => m.id)));
          setImplicitFull(!!menuRes.data.implicitFullAccess);
        }
        if (actionRes?.success) {
          const mods: ActionModule[] = actionRes.data.modules || [];
          setModules(mods);
          const granted = new Set<number>();
          mods.forEach((mod) => mod.actions.forEach((a) => { if (a.granted) granted.add(a.id); }));
          setActionChecked(granted);
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudieron cargar los permisos del rol.' }))
      .finally(() => setLoadingPerms(false));
  };

  // Menús agrupados por padre (jerarquía de 2+ niveles renderizada indentada).
  const rootMenus = useMemo(() => menus.filter((m) => !m.parentId), [menus]);
  const childrenOf = (parentId: number) => menus.filter((m) => m.parentId === parentId);

  const toggleMenu = (id: number) => {
    if (isRoot) return;
    setMenuChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Marca/desmarca un menú padre y toda su rama.
  const toggleBranch = (parentId: number, on: boolean) => {
    if (isRoot) return;
    const collect = (id: number, acc: number[]) => {
      acc.push(id);
      childrenOf(id).forEach((c) => collect(c.id, acc));
      return acc;
    };
    const ids = collect(parentId, []);
    setMenuChecked((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const toggleAction = (id: number) => {
    if (isRoot) return;
    setActionChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleModule = (mod: ActionModule, on: boolean) => {
    if (isRoot) return;
    setActionChecked((prev) => {
      const next = new Set(prev);
      mod.actions.forEach((a) => (on ? next.add(a.id) : next.delete(a.id)));
      return next;
    });
  };

  const save = () => {
    if (!selectedRole || isRoot) return;
    setSaving(true);
    setMessage(null);
    const call = tab === 'views'
      ? api.updateSystemRoleMenuPermissions(selectedRole.id, [...menuChecked])
      : api.updateSystemRoleActionPermissions(selectedRole.id, [...actionChecked]);
    call
      .then((res) => {
        if (res?.success) setMessage({ type: 'success', text: res.message || 'Permisos guardados.' });
        else setMessage({ type: 'error', text: res?.message || 'No se pudieron guardar los permisos.' });
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudieron guardar los permisos.' }))
      .finally(() => setSaving(false));
  };

  const tabStyle = (active: boolean): CSSProperties => ({ padding: '10px 16px', border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: -1, color: active ? 'var(--fg,#0f172a)' : 'var(--muted,#64748b)', borderBottom: active ? '2px solid var(--brand,#0891b2)' : '2px solid transparent' });
  const roleItemStyle = (active: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500, background: active ? 'var(--sb-active-bg,rgba(8,145,178,.10))' : 'transparent', color: active ? 'var(--brand,#0891b2)' : 'var(--fg-2,#334155)', transition: 'all .12s' });

  return (
    <>
      <PageHeader crumb="Sistema · Roles" title="Permisos por rol" sub="Asigna qué puede ver (vistas) y qué puede ejecutar (acciones) cada rol." />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Master: lista de roles */}
        <div style={{ ...card, position: 'sticky', top: 16 }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border,#e5e8ec)' }}>
            <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} placeholder="Buscar rol…" style={input} />
          </div>
          <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', padding: 8 }}>
            {filteredRoles.map((role) => (
              <div key={role.id} onClick={() => loadPermissions(role)} style={roleItemStyle(selectedRole?.id === role.id)}>
                <Icon d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 20v-2a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8" size={16} sw={1.8} />
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{role.description}</span>
                {role.id === ROOT_ROLE_ID && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand,#0891b2)' }}>ROOT</span>}
              </div>
            ))}
            {filteredRoles.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted,#64748b)', fontSize: 13 }}>Sin roles.</div>}
          </div>
        </div>

        {/* Detail: permisos del rol */}
        <div style={card}>
          {!selectedRole ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted,#64748b)' }}>Selecciona un rol para administrar sus permisos.</div>
          ) : (
            <>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>{selectedRole.description}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted,#64748b)', marginTop: 2 }}>{tab === 'views' ? 'Vistas y menús visibles' : 'Acciones ejecutables por módulo'}</div>
                </div>
                {!isRoot && (
                  <button onClick={save} disabled={saving} style={{ height: 38, padding: '0 18px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando…' : 'Guardar permisos'}</button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 4, padding: '0 20px', borderBottom: '1px solid var(--border,#e5e8ec)' }}>
                <button onClick={() => setTab('views')} style={tabStyle(tab === 'views')}>Vistas</button>
                <button onClick={() => setTab('actions')} style={tabStyle(tab === 'actions')}>Acciones</button>
              </div>

              {message && (
                <div style={{ margin: '14px 20px 0', padding: '10px 12px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, color: message.type === 'error' ? '#b91c1c' : '#047857', background: message.type === 'error' ? 'rgba(239,68,68,.10)' : 'rgba(16,185,129,.12)', border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,.18)' : 'rgba(16,185,129,.18)'}` }}>{message.text}</div>
              )}

              {isRoot && (
                <div style={{ margin: '14px 20px 0', padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#4338ca', background: 'rgba(99,102,241,.10)', border: '1px solid rgba(99,102,241,.20)' }}>
                  El rol administrador principal tiene acceso total automáticamente. No requiere asignación manual.
                </div>
              )}

              <div style={{ padding: 20 }}>
                {loadingPerms ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted,#64748b)', fontSize: 13 }}>Cargando permisos…</div>
                ) : tab === 'views' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {rootMenus.map((parent) => {
                      const kids = childrenOf(parent.id);
                      const allBranch = [parent.id, ...kids.map((k) => k.id)];
                      const branchOn = allBranch.every((id) => menuChecked.has(id));
                      return (
                        <div key={parent.id} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
                            <Checkbox checked={menuChecked.has(parent.id)} disabled={isRoot} onChange={() => toggleMenu(parent.id)} />
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg,#0f172a)', flex: 1 }}>{parent.label}</span>
                            {kids.length > 0 && !isRoot && (
                              <button onClick={() => toggleBranch(parent.id, !branchOn)} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand,#0891b2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>{branchOn ? 'Quitar rama' : 'Toda la rama'}</button>
                            )}
                          </div>
                          {kids.map((child) => (
                            <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px 7px 30px' }}>
                              <Checkbox checked={menuChecked.has(child.id)} disabled={isRoot} onChange={() => toggleMenu(child.id)} />
                              <span style={{ fontSize: 13, color: 'var(--fg-2,#334155)', flex: 1 }}>{child.label}</span>
                              {child.route && <span style={{ fontSize: 11, color: 'var(--muted,#94a3b8)', fontFamily: 'JetBrains Mono,monospace' }}>{child.route}</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {rootMenus.length === 0 && <div style={{ color: 'var(--muted,#64748b)', fontSize: 13 }}>No hay menús para asignar.</div>}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {modules.map((mod) => {
                      const allOn = mod.actions.every((a) => actionChecked.has(a.id));
                      return (
                        <div key={mod.moduleCode} style={{ border: '1px solid var(--border,#e5e8ec)', borderRadius: 12, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--surface-2,#f7f8fa)', borderBottom: '1px solid var(--border,#e5e8ec)' }}>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg,#0f172a)' }}>{moduleLabel(mod.moduleCode)}</span>
                            {!isRoot && <button onClick={() => toggleModule(mod, !allOn)} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand,#0891b2)', background: 'transparent', border: 'none', cursor: 'pointer' }}>{allOn ? 'Quitar todo' : 'Marcar todo'}</button>}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 4, padding: 12 }}>
                            {mod.actions.map((a) => (
                              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 4px' }}>
                                <Checkbox checked={actionChecked.has(a.id)} disabled={isRoot} onChange={() => toggleAction(a.id)} />
                                <span style={{ fontSize: 13, color: 'var(--fg-2,#334155)' }}>{a.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {modules.length === 0 && <div style={{ color: 'var(--muted,#64748b)', fontSize: 13 }}>No hay acciones registradas todavía.</div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
