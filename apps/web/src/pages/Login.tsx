import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { api } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('jose.narvaez@sonovista.co');
  const [password, setPassword] = useState('••••••••');
  const [remember, setRemember] = useState(true);
  const [logging, setLogging] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [requestingRecovery, setRequestingRecovery] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [passwordChangeMessage, setPasswordChangeMessage] = useState('');
  const [passwordRecoveryEmail, setPasswordRecoveryEmail] = useState('');
  const [passwordRecoveryMessage, setPasswordRecoveryMessage] = useState('');
  const [passwordRecoverySuccess, setPasswordRecoverySuccess] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [message, setMessage] = useState('');

  const doLogin = async () => {
    if (logging) return;
    setLogging(true);
    setMessage('');
    try {
      const response = await api.login(email, password);

      if (!response?.success) {
        setMessage(response?.message || 'No se pudo iniciar sesión. Revisa tus credenciales.');
        return;
      }

      if (response.data?.status === 'change') {
        setShowPasswordChange(true);
        setPasswordChangeMessage(response.message || 'Debes cambiar tu contraseña antes de ingresar.');
        setMessage(response.message || 'Debes cambiar tu contraseña antes de ingresar.');
        return;
      }

      if (response.data?.status === 'success') {
        login(response.data.user);
        navigate('/');
        return;
      }

      setMessage('Respuesta de autenticación no reconocida. Intenta nuevamente.');
    } catch {
      setMessage('No se pudo conectar con el servidor de autenticación. Intenta nuevamente.');
    } finally {
      setLogging(false);
    }
  };

  const openPasswordRecovery = () => {
    setPasswordRecoveryEmail(email || '');
    setPasswordRecoveryMessage('');
    setPasswordRecoverySuccess(false);
    setShowPasswordRecovery(true);
  };

  const requestPasswordRecovery = async () => {
    if (requestingRecovery) return;
    setRequestingRecovery(true);
    setPasswordRecoveryMessage('');
    setPasswordRecoverySuccess(false);

    try {
      const response = await api.forgotPassword({ email: passwordRecoveryEmail });

      if (!response?.success) {
        setPasswordRecoveryMessage(response?.message || 'Ingresa un correo válido para recuperar tu contraseña.');
        return;
      }

      setPasswordRecoverySuccess(true);
      setPasswordRecoveryMessage(response.message || 'Si el correo está registrado, recibirás las instrucciones para recuperar tu contraseña.');
    } catch {
      setPasswordRecoveryMessage('No se pudo conectar con el servidor de autenticación. Intenta nuevamente.');
    } finally {
      setRequestingRecovery(false);
    }
  };

  const doRequiredPasswordChange = async () => {
    if (changingPassword) return;
    setChangingPassword(true);
    setPasswordChangeMessage('');
    try {
      const response = await api.changeRequiredPassword({
        username: email,
        currentPassword: password,
        newPassword,
        repeatPassword,
      });

      if (!response?.success) {
        setPasswordChangeMessage(response?.message || 'No se pudo actualizar la contraseña. Revisa los datos e intenta nuevamente.');
        return;
      }

      setShowPasswordChange(false);
      setNewPassword('');
      setRepeatPassword('');
      setPassword('');
      setMessage('Contraseña actualizada correctamente. Inicia sesión nuevamente con tu nueva contraseña.');
    } catch {
      setPasswordChangeMessage('No se pudo conectar con el servidor de autenticación. Intenta nuevamente.');
    } finally {
      setChangingPassword(false);
    }
  };

  const inputStyle = { width: '100%', height: 46, padding: '0 14px 0 40px', borderRadius: 11, border: '1px solid var(--border-strong,#d5d9e0)', background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg,#0f172a)', fontSize: 14.5, outline: 'none', transition: 'border-color .15s,box-shadow .15s' };
  const onFocus = (e) => { e.target.style.borderColor = 'var(--brand,#0891b2)'; e.target.style.boxShadow = '0 0 0 3px var(--brand-soft,#ecfeff)'; };
  const onBlur = (e) => { e.target.style.borderColor = 'var(--border-strong,#d5d9e0)'; e.target.style.boxShadow = 'none'; };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--surface,#fff)' }}>
      <div style={{ flex: 1.05, position: 'relative', overflow: 'hidden', background: '#0a0f1a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '56px 60px', color: '#e8ecf3', minWidth: 0 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 500px at 15% 0%,rgba(34,211,238,.16),transparent 60%),radial-gradient(700px 600px at 90% 100%,rgba(34,211,238,.09),transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5, backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)', backgroundSize: '52px 52px', maskImage: 'radial-gradient(700px 500px at 30% 20%,#000,transparent 75%)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Sonoffice" style={{ width: 34, height: 34 }} />
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em' }}>
            <span style={{ color: '#22d3ee' }}>Son</span>office
          </span>
        </div>
        <div style={{ position: 'relative', maxWidth: 440 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.14em', color: '#22d3ee', textTransform: 'uppercase', marginBottom: 18 }}>Plataforma ERP · v3.0</div>
          <h1 style={{ fontSize: 38, lineHeight: 1.15, fontWeight: 800, letterSpacing: '-.03em', margin: '0 0 18px' }}>Toda tu operación,<br />en un solo lugar.</h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: '#9fb0c4', margin: '0 0 34px' }}>Órdenes de producción, facturación, contratos y gestión documental. Rápido, claro y preparado para escalar.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['Trazabilidad completa de cada orden', 'Indicadores en tiempo real', 'Roles y permisos granulares'].map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 13, fontSize: 14.5, color: '#c9d4e0' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(34,211,238,.14)', display: 'grid', placeItems: 'center', color: '#22d3ee', flex: 'none' }}>
                  <Icon d="M20 6L9 17l-5-5" size={16} sw={2.2} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', fontSize: 12.5, color: '#64748b' }}>© 2026 Sonovista · Todos los derechos reservados</div>
      </div>

      <div style={{ flex: 0.95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', minWidth: 0 }}>
        <div style={{ width: '100%', maxWidth: 388, animation: 'scpop .5s cubic-bezier(.2,.7,.3,1)' }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 6px', color: 'var(--fg,#0f172a)' }}>Iniciar sesión</h2>
          <p style={{ margin: '0 0 30px', color: 'var(--muted,#64748b)', fontSize: 14.5 }}>Ingresa tus credenciales para continuar.</p>

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 7 }}>Correo o usuario</label>
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}>
              <Icon d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6" size={17} sw={1.9} />
            </span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@sonovista.co" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </div>

          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 7 }}>Contraseña</label>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}>
              <Icon d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" size={17} sw={1.9} />
            </span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
            <label onClick={() => setRemember((r) => !r)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, color: 'var(--fg-2,#334155)', userSelect: 'none' }}>
              <span style={{ width: 18, height: 18, borderRadius: 6, border: '1.5px solid var(--border-strong,#d5d9e0)', display: 'grid', placeItems: 'center', transition: 'all .15s', ...(remember ? { background: 'var(--brand,#0891b2)', borderColor: 'var(--brand,#0891b2)' } : {}) }}>
                <Icon d="M20 6L9 17l-5-5" size={12} sw={3} stroke="#fff" style={{ display: remember ? 'block' : 'none' }} />
              </span>
              Recordar sesión
            </label>
            <a href="#" onClick={(e) => { e.preventDefault(); openPasswordRecovery(); }} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--brand,#0891b2)', textDecoration: 'none' }}>¿Olvidaste tu contraseña?</a>
          </div>

          {message && (
            <div style={{ margin: '-6px 0 16px', padding: '10px 12px', borderRadius: 10, background: 'rgba(244,63,94,.08)', color: '#be123c', border: '1px solid rgba(244,63,94,.22)', fontSize: 13, lineHeight: 1.4 }}>
              {message}
            </div>
          )}

          <button disabled={logging} onClick={doLogin} style={{ width: '100%', height: 48, border: 'none', borderRadius: 12, background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', fontSize: 15, fontWeight: 700, cursor: logging ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, transition: 'transform .12s,filter .15s', boxShadow: '0 6px 18px -6px rgba(15,23,42,.4)', opacity: logging ? 0.82 : 1 }} onMouseEnter={(e) => { if (!logging) e.currentTarget.style.filter = 'brightness(1.08)'; }} onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}>
            {logging && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'scspin .7s linear infinite', display: 'inline-block' }} />}
            {logging ? 'Ingresando…' : 'Ingresar'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 13, color: 'var(--faint,#94a3b8)' }}>Acceso restringido a personal autorizado</div>
        </div>
      </div>

      {showPasswordChange && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.56)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 20 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface,#fff)', borderRadius: 18, padding: 24, boxShadow: '0 24px 70px -24px rgba(15,23,42,.65)', border: '1px solid var(--border-strong,#d5d9e0)' }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px', color: 'var(--fg,#0f172a)' }}>Actualiza tu contraseña</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--muted,#64748b)', fontSize: 14, lineHeight: 1.5 }}>Por seguridad, tu contraseña venció. Elige una nueva para poder ingresar.</p>

            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 7 }}>Nueva contraseña</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}>
                <Icon d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" size={17} sw={1.9} style={{}} />
              </span>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 7 }}>Repetir nueva contraseña</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}>
                <Icon d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" size={17} sw={1.9} style={{}} />
              </span>
              <input type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} placeholder="Repite tu contraseña" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            <p style={{ margin: '0 0 16px', color: 'var(--muted,#64748b)', fontSize: 12.5, lineHeight: 1.45 }}>Debe tener mínimo 8 caracteres, una letra, una mayúscula, un número y un carácter especial.</p>

            {passwordChangeMessage && (
              <div style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: 10, background: 'rgba(244,63,94,.08)', color: '#be123c', border: '1px solid rgba(244,63,94,.22)', fontSize: 13, lineHeight: 1.4 }}>
                {passwordChangeMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button disabled={changingPassword} onClick={doRequiredPasswordChange} style={{ flex: 1, height: 46, border: 'none', borderRadius: 12, background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', fontSize: 14.5, fontWeight: 700, cursor: changingPassword ? 'default' : 'pointer', opacity: changingPassword ? 0.82 : 1 }}>
                {changingPassword ? 'Actualizando…' : 'Actualizar contraseña'}
              </button>
              <button disabled={changingPassword} onClick={() => setShowPasswordChange(false)} style={{ height: 46, border: '1px solid var(--border-strong,#d5d9e0)', borderRadius: 12, background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg-2,#334155)', fontSize: 14.5, fontWeight: 700, cursor: changingPassword ? 'default' : 'pointer', padding: '0 16px' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordRecovery && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.56)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 20 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface,#fff)', borderRadius: 18, padding: 24, boxShadow: '0 24px 70px -24px rgba(15,23,42,.65)', border: '1px solid var(--border-strong,#d5d9e0)' }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 8px', color: 'var(--fg,#0f172a)' }}>Recuperar contraseña</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--muted,#64748b)', fontSize: 14, lineHeight: 1.5 }}>Ingresa tu correo y, si está registrado, recibirás una contraseña temporal.</p>

            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2,#334155)', marginBottom: 7 }}>Correo</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint,#94a3b8)', display: 'flex' }}>
                <Icon d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6" size={17} sw={1.9} style={{}} />
              </span>
              <input value={passwordRecoveryEmail} onChange={(e) => setPasswordRecoveryEmail(e.target.value)} placeholder="nombre@sonovista.co" style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>

            {passwordRecoveryMessage && (
              <div style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: 10, background: passwordRecoverySuccess ? 'rgba(16,185,129,.08)' : 'rgba(244,63,94,.08)', color: passwordRecoverySuccess ? '#047857' : '#be123c', border: passwordRecoverySuccess ? '1px solid rgba(16,185,129,.22)' : '1px solid rgba(244,63,94,.22)', fontSize: 13, lineHeight: 1.4 }}>
                {passwordRecoveryMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button disabled={requestingRecovery} onClick={requestPasswordRecovery} style={{ flex: 1, height: 46, border: 'none', borderRadius: 12, background: 'var(--primary,#0f172a)', color: 'var(--primary-fg,#fff)', fontSize: 14.5, fontWeight: 700, cursor: requestingRecovery ? 'default' : 'pointer', opacity: requestingRecovery ? 0.82 : 1 }}>
                {requestingRecovery ? 'Enviando…' : 'Enviar instrucciones'}
              </button>
              <button disabled={requestingRecovery} onClick={() => setShowPasswordRecovery(false)} style={{ height: 46, border: '1px solid var(--border-strong,#d5d9e0)', borderRadius: 12, background: 'var(--surface-2,#f7f8fa)', color: 'var(--fg-2,#334155)', fontSize: 14.5, fontWeight: 700, cursor: requestingRecovery ? 'default' : 'pointer', padding: '0 16px' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
