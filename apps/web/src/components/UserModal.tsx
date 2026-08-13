import { Icon } from '../lib/icons';

const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 8 };
const inBase = { width: '100%', height: 44, padding: '0 13px', borderRadius: 10, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg,#0f172a)', fontSize: 14, outline: 'none', transition: 'all .15s' };

// New-user modal (Usuarios tab).
export default function UserModal({ onClose }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,26,.55)', backdropFilter: 'blur(3px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'scfade .2s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--surface,#fff)', border: '1px solid var(--border,#e5e8ec)', borderRadius: 18, boxShadow: 'var(--shadow-lg,0 20px 60px rgba(0,0,0,.3))', overflow: 'hidden', animation: 'scpop .25s cubic-bezier(.2,.7,.3,1)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border,#e5e8ec)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg,#0f172a)' }}>Nuevo usuario</div>
            <div style={{ fontSize: 13, color: 'var(--muted,#64748b)' }}>Crea una cuenta y asigna un rol.</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, border: 'none', background: 'var(--surface-3,#f1f3f6)', borderRadius: 9, color: 'var(--muted,#64748b)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon d="M18 6L6 18M6 6l12 12" size={17} sw={2} />
          </button>
        </div>
        <div style={{ padding: '22px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={lbl}>Nombre completo</label>
            <input placeholder="Nombre y apellido" style={inBase} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={lbl}>Correo electrónico</label>
            <input placeholder="nombre@sonovista.co" style={inBase} />
          </div>
          <div>
            <label style={lbl}>Rol</label>
            <select style={inBase}>
              <option>Administrador</option><option>Editor</option><option>Operador</option><option>Consulta</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Estado</label>
            <select style={inBase}>
              <option>Activo</option><option>Inactivo</option>
            </select>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border,#e5e8ec)', background: 'var(--surface-2,#f7f8fa)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ height: 40, padding: '0 18px', border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface,#fff)', color: 'var(--fg-2,#334155)', borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onClose} style={{ height: 40, padding: '0 20px', border: 'none', background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Crear usuario</button>
        </div>
      </div>
    </div>
  );
}
