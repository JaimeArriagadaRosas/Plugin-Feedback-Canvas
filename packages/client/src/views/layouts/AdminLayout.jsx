/**
 * AdminLayout — Layout exclusivo para el rol Administrador.
 *
 * REGLA DE SEPARACIÓN VISUAL (innegociable):
 *   ▸ En /admin o /  → Barra negra de administración visible.
 *   ▸ En /teacher/*  → Barra de admin COMPLETAMENTE OCULTA.
 *                      El admin ve exactamente lo mismo que un docente real.
 *                      Solo aparece un pequeño botón flotante "Volver a Admin".
 *
 * Esta separación garantiza que:
 *   1. Un docente real (role=teacher) jamás llega a este componente.
 *   2. Un admin en vista docente no puede distinguirse de un docente real
 *      mirando la pantalla — la vista es idéntica.
 *   3. El botón flotante es discreto y no interfiere con la interfaz del docente.
 */

import { Outlet, useNavigate, useLocation } from 'react-router-dom';


export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Determinar en qué vista estamos ────────────────────────────────────────
  const esVistaAdmin   = location.pathname.startsWith('/admin') || location.pathname === '/';

  return (
    <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'Lato', sans-serif" }}>
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>





      {/* Contenido principal — <Outlet /> renderiza la ruta activa */}
      <main id="main-content" style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
