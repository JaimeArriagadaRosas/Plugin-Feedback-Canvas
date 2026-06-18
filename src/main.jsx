import React, { useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';


// ─────────────────────────────────────────────────────────────────────────────
// LOGGER DE FRONTEND — Logging estructurado para depuración
// ─────────────────────────────────────────────────────────────────────────────
const FrontendLogger = {
  _prefix: '[PluginFeedback]',
  info: (...args) => console.info(FrontendLogger._prefix, ...args),
  warn: (...args) => console.warn(FrontendLogger._prefix, ...args),
  error: (...args) => console.error(FrontendLogger._prefix, ...args),
  debug: (...args) => {
    if (import.meta.env.DEV) console.debug(FrontendLogger._prefix + '[DEBUG]', ...args);
  },
  group: (label, fn) => {
    if (import.meta.env.DEV) { console.group(FrontendLogger._prefix + ' ' + label); fn(); console.groupEnd(); }
    else fn();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. CAPTURAR EL TOKEN DE LA URL Y GUARDARLO EN LOCALSTORAGE
// ─────────────────────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const tokenFromUrl = urlParams.get('lti_token');
if (tokenFromUrl) {
  try {
    localStorage.setItem('lti_token', tokenFromUrl);
  } catch (e) {
    console.error('LocalStorage error', e);
  }
  urlParams.delete('lti_token');
  const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
  window.history.replaceState({}, document.title, newUrl);
  FrontendLogger.info('Token LTI capturado desde URL y guardado en localStorage.');
}

// FIX CRÍTICO: Si el plugin se está ejecutando dentro de un iframe (Canvas),
// NUNCA debe usar un 'dev-token' remanente de pruebas locales directas.
let isIframe = false;
try {
  isIframe = window.self !== window.top;
} catch (e) {
  // Si arroja SecurityError al acceder a window.top, estamos definitivamente en un iframe cross-origin (Canvas).
  isIframe = true;
}

if (isIframe) {
  try {
    if (localStorage.getItem('lti_token') === 'dev-token') {
      localStorage.removeItem('lti_token');
      FrontendLogger.info('Se detectó ejecución en iframe. dev-token eliminado de localStorage.');
    }
  } catch (e) {
    // Ignorar si localStorage también está bloqueado
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PARCHEAR FETCH PARA INYECTAR EL TOKEN LTI EN TODAS LAS PETICIONES API
//    FIX CRÍTICO: Template literal roto corregido: `Bearer ${token}`
// ─────────────────────────────────────────────────────────────────────────────
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  if (typeof url === 'string' && url.startsWith('/')) {
    options.credentials = 'include';
    const token = localStorage.getItem('lti_token');
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      };
    }
    FrontendLogger.debug(`Fetch → ${url}`, { hasToken: !!token });
  }
  return originalFetch(url, options);
};

// ─────────────────────────────────────────────────────────────────────────────
// LAZY IMPORTS — Layouts y vistas principales
// ─────────────────────────────────────────────────────────────────────────────
import AdminLayout from './vista/layouts/AdminLayout';
import TeacherLayout from './vista/layouts/TeacherLayout';
import AdminPanel from './vista/admin/AdminPanel';
import StudentFeedbackView from './vista/feedback/StudentFeedbackView';


// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA DE ACCESO RESTRINGIDO (solo se muestra cuando la API confirma que
// no hay sesión válida, nunca antes de intentar la llamada)
// ─────────────────────────────────────────────────────────────────────────────
function AccesoRestringido({ apiError }) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleAccesoLocal = async (role) => {
    setLoading(true);
    setLocalError(null);
    FrontendLogger.info(`Solicitando acceso local con rol: ${role}`);
    try {
      const response = await fetch('/api/config/set-local-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (response.ok) {
        localStorage.setItem('lti_token', 'dev-token');
        FrontendLogger.info(`Acceso local concedido como ${role}. Recargando...`);
        window.location.reload();
      } else {
        const data = await response.json();
        FrontendLogger.error('El servidor rechazó el acceso local:', data);
        setLocalError(`Error del servidor: ${data?.error?.mensaje || response.status}`);
      }
    } catch (e) {
      FrontendLogger.error('Error de red al solicitar acceso local:', e);
      setLocalError(`Error de red: ${e.message}. ¿El servidor backend está corriendo en :3000?`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "60px 40px", fontFamily: "'Lato', sans-serif", textAlign: "center", background: "#fdfefe", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: "640px", background: "#ffffff", border: "1px solid #c7cdd1", borderRadius: "8px", padding: "40px", boxShadow: "0 4px 15px rgba(0,0,0,0.08)" }}>
        <h2 style={{ color: "#c0392b", fontSize: "24px", fontWeight: "700", margin: "0 0 10px 0" }}>
          Acceso LTI Restringido
        </h2>
        <p style={{ color: "#2d3b45", fontSize: "15px", lineHeight: "1.6", margin: "0 0 20px 0" }}>
          No se detectó una sesión LTI válida. El plugin debe iniciarse desde Canvas LMS.
        </p>

        {/* Panel de información de depuración */}
        <div style={{ padding: "12px 16px", background: "#f8f9fa", border: "1px solid #ddd", borderRadius: "4px", fontSize: "12px", textAlign: "left", marginBottom: "20px", fontFamily: "monospace" }}>
          <strong>ℹ️ DIAGNÓSTICO:</strong><br />
          API Error: {apiError || 'Sin error de API reportado'}<br />
          URL Actual: {window.location.href}<br />
          Token en LocalStorage: {(() => {
            try {
              return localStorage.getItem('lti_token') ? `✅ Existe (${localStorage.getItem('lti_token').length} chars)` : '❌ No existe';
            } catch(e) {
              return '⚠️ Bloqueado (SecurityError)';
            }
          })()}<br />
          Cookie LTI: {(() => {
            try {
              return document.cookie.includes('lti_token') ? '✅ Presente' : '❌ Ausente';
            } catch(e) {
              return '⚠️ Bloqueado';
            }
          })()}<br />
          Entorno: {import.meta.env.DEV ? 'Desarrollo (DEV)' : 'Producción'}
        </div>

        {localError && (
          <div style={{ padding: "10px", background: "#fde8e8", border: "1px solid #c0392b", borderRadius: "4px", marginBottom: "16px", fontSize: "13px", color: "#c0392b", textAlign: "left" }}>
            ⚠️ {localError}
          </div>
        )}

        {/* Sección de acceso local — disponible tanto en DEV como cuando el modo local está habilitado */}
        <div style={{ marginTop: "30px", borderTop: "2px dashed #c7cdd1", paddingTop: "30px", background: "#f0f7ff", borderRadius: "6px", padding: "20px" }}>
          <h3 style={{ color: "#0770a3", fontSize: "16px", margin: "0 0 10px 0", fontWeight: "700" }}>
            🖥️ ENTORNO LOCAL DETECTADO
          </h3>
          <p style={{ fontSize: "13px", color: "#444", lineHeight: "1.5", margin: "0 0 20px 0" }}>
            Selecciona un rol para ingresar al entorno local de Canvas:
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => handleAccesoLocal('admin')}
              disabled={loading}
              style={{ background: "#2d3b45", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
            >
              {loading ? "Cargando..." : "⚙️ Administrador"}
            </button>
            <button
              onClick={() => handleAccesoLocal('teacher')}
              disabled={loading}
              style={{ background: "#0770a3", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
            >
              {loading ? "Cargando..." : "📋 Docente"}
            </button>
            <button
              onClick={() => handleAccesoLocal('student')}
              disabled={loading}
              style={{ background: "#27ae60", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
            >
              {loading ? "Cargando..." : "🎓 Estudiante"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA DE CARGA
// ─────────────────────────────────────────────────────────────────────────────
function LoadingScreen({ message }) {
  return (
    <div style={{ padding: 40, fontFamily: "'Lato', sans-serif", color: "#2d3b45", display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{ width: 20, height: 20, border: "3px solid #c7cdd1", borderTopColor: "#0770a3", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      {message || "Inicializando sesión..."}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT DE LA APLICACIÓN
// FIX CRÍTICO 2: La llamada a /api/config/me se hace SIEMPRE.
//   El token (si existe) ya va en el header por el fetch patcheado.
//   Solo si la respuesta indica error o rol inválido se muestra AccesoRestringido.
//
// FIX CRÍTICO 3: Las rutas para ADMIN usan un layout flat con rutas explícitas,
//   no anidado como children opaco dentro de AdminLayout.
//   Admin ve su panel + puede acceder a todas las rutas del docente.
// ─────────────────────────────────────────────────────────────────────────────
function AppRoot() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const fetchRole = useCallback(async () => {
    FrontendLogger.info('Iniciando verificación de sesión → GET /api/config/me');
    try {
      const resp = await fetch('/api/config/me');
      
      FrontendLogger.debug('Respuesta de /api/config/me:', { status: resp.status, ok: resp.ok });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        const msg = `HTTP ${resp.status}: ${errText.substring(0, 200)}`;
        FrontendLogger.warn('Sesión inválida según el servidor:', msg);
        setApiError(msg);
        setRole(null);
        return;
      }

      const data = await resp.json();
      FrontendLogger.group('Datos de sesión recibidos', () => {
        FrontendLogger.info('Usuario:', data.user);
        FrontendLogger.info('Rol:', data.role);
        FrontendLogger.info('Roles LTI:', data.roles);
        FrontendLogger.info('Curso:', data.courseId);
      });

      if (data.exito && data.role) {
        setRole(data.role);
        setApiError(null);
      } else {
        FrontendLogger.warn('Respuesta de API sin rol válido:', data);
        setApiError(JSON.stringify(data));
        setRole(null);
      }
    } catch (e) {
      FrontendLogger.error('Error de red al verificar sesión:', e.message);
      setApiError(`Error de red: ${e.message}`);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  if (loading) return <LoadingScreen message="Verificando sesión con el servidor local..." />;

  if (!role) {
    return <AccesoRestringido apiError={apiError} />;
  }

  FrontendLogger.info(`Sesión válida. Renderizando interfaz para rol: ${role}`);

  // ─── ENRUTAMIENTO POR ROL ───────────────────────────────────────────────
  return (
    <React.StrictMode>
      <BrowserRouter>

        {/* ── ROL: ADMIN ────────────────────────────────────────────────────── */}
        {role === 'admin' && (
          <Routes>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="/admin/*" element={<AdminPanel onExit={() => window.location.href='/teacher/courses'} />} />
              <Route path="/teacher/*" element={<TeacherLayout isAdminView={true} />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Routes>
        )}

        {/* ── ROL: TEACHER ───────────────────────────────────────────────────── */}
        {role === 'teacher' && (
          <Routes>
            <Route path="/" element={<Navigate to="/teacher/courses" replace />} />
            <Route path="/teacher/*" element={<TeacherLayout isAdminView={false} />} />
            <Route path="*" element={<Navigate to="/teacher/courses" replace />} />
          </Routes>
        )}

        {/* ── ROL: STUDENT ────────────────────────────────────────────────── */}
        {role === 'student' && (
          <Routes>
            <Route path="/" element={<Navigate to="/student" replace />} />
            <Route path="/student/*" element={<StudentFeedbackView onExit={() => window.location.href = '/'} />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        )}

      </BrowserRouter>
    </React.StrictMode>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("React Error Boundary Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", fontFamily: "sans-serif", color: "red" }}>
          <h2>Algo salió mal en el Frontend (React Crash)</h2>
          <pre style={{ background: "#f8d7da", padding: "10px", border: "1px solid #f5c6cb", color: "#721c24", overflow: "auto" }}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <pre style={{ background: "#f8f9fa", padding: "10px", marginTop: "10px", border: "1px solid #ddd", fontSize: "12px", overflow: "auto" }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: "20px", padding: "10px 20px" }}>Recargar página</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <AppRoot />
  </ErrorBoundary>
);