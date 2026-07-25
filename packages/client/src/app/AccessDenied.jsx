import { useState } from 'react';
import { api } from "shared/api";
import { isIframe, setToken } from 'shared/lib/authToken';
import logger from '../utils/logger';

const log = {
  info: (msg, payload) => logger.info('AccessDenied', msg, payload),
  error: (msg, payload) => logger.error('AccessDenied', msg, payload),
};

export default function AccessDenied({ apiError }) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLocalError(null);
    try {
      const response = await api.post('/auth/local-login', { email, password });
      if (response.success && response.devToken) {
        setToken(response.devToken);
        log.info('Login local exitoso. Recargando...');
        window.location.reload();
      } else {
        setLocalError('Credenciales inválidas');
      }
    } catch (e) {
      log.error('Error en login local:', { message: e.message });
      setLocalError(e.response?.data?.error || 'Error del servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '60px 40px', fontFamily: "'Lato', sans-serif", textAlign: 'center', background: '#fdfefe', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: '640px', background: '#ffffff', border: '1px solid #c7cdd1', borderRadius: '8px', padding: '40px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
        <h2 style={{ color: '#c0392b', fontSize: '24px', fontWeight: '700', margin: '0 0 10px 0' }}>
          Acceso LTI Restringido
        </h2>
        <p style={{ color: '#2d3b45', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
          No se detectó una sesión LTI válida o hubo un problema temporal de conexión.
        </p>

        <div style={{ marginBottom: '25px' }}>
          <button
            onClick={() => {
              log.info('Usuario solicitó reintento de conexión LTI');
              window.location.reload();
            }}
            style={{
              background: '#0770a3',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '4px',
              fontSize: '15px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🔄 Reintentar Conexión LTI / Refrescar Sesión
          </button>
        </div>

        {/* Panel de información de depuración */}
        <div style={{ padding: '12px 16px', background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', textAlign: 'left', marginBottom: '20px', fontFamily: 'monospace' }}>
          <strong>ℹ️ DIAGNÓSTICO:</strong><br />
          API Error: {apiError || 'Sin error de API reportado'}<br />
          URL Actual: {window.location.href}<br />
          Token en LocalStorage: {(() => {
            try {
              return localStorage.getItem('lti_token') ? `✅ Existe (${localStorage.getItem('lti_token').length} chars)` : '❌ No existe';
            } catch {
              return '⚠️ Bloqueado (SecurityError)';
            }
          })()}<br />
          Cookie LTI: {(() => {
            try {
              return document.cookie.includes('lti_token') ? '✅ Presente' : '❌ Ausente';
            } catch {
              return '⚠️ Bloqueado';
            }
          })()}<br />
          Entorno: {import.meta.env.DEV ? 'Desarrollo (DEV)' : 'Producción'}
        </div>

        {localError && (
          <div style={{ padding: '10px', background: '#fde8e8', border: '1px solid #c0392b', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#c0392b', textAlign: 'left' }}>
            ⚠️ {localError}
          </div>
        )}

        {/* Formulario de login local — SOLO visible en Desarrollo y FUERA de un iframe */}
        {import.meta.env.DEV && !isIframe && (
          <div style={{ marginTop: '30px', borderTop: '2px dashed #c7cdd1', paddingTop: '30px', background: '#f0f7ff', borderRadius: '6px', padding: '20px' }}>
            <h3 style={{ color: '#0770a3', fontSize: '16px', margin: '0 0 10px 0', fontWeight: '700' }}>
              🖥️ ENTORNO LOCAL DETECTADO
            </h3>
            <p style={{ fontSize: '13px', color: '#444', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Ingrese sus credenciales locales para continuar:
            </p>
            <form onSubmit={handleLocalLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px', margin: '0 auto' }}>
              <input
                type="email"
                placeholder="Email (ej: profesor@canvas.local)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #c7cdd1', fontSize: '14px' }}
              />
              <input
                type="password"
                placeholder="Password (ej: password123)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #c7cdd1', fontSize: '14px' }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{ background: '#0770a3', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '12px' }}>
              Usuarios de prueba: profesor@canvas.local, estudiante1@canvas.local, admin@canvas.local (password: password123)
            </p>
          </div>
        )}

        {/* Mensaje de seguridad para iframes */}
        {isIframe && (
          <div style={{ marginTop: '30px', padding: '15px', background: '#f8f9fa', borderLeft: '4px solid #e74c3c', borderRadius: '4px', textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: '1.5' }}>
              <strong>🔒 Seguridad LTI:</strong> Esta sesión ha sido bloqueada. Por motivos de seguridad, no se permite el acceso manual ni la simulación de roles cuando el plugin se ejecuta embebido dentro del LMS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
