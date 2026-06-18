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
  const esVistaDocente = location.pathname.startsWith('/teacher');

  return (
    <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'Lato', sans-serif" }}>

      {/* ═══════════════════════════════════════════════════════════════════════
          BARRA SUPERIOR DE ADMINISTRACIÓN
          SOLO se muestra cuando el admin está en su panel (/admin o /).
          Cuando está en la vista del docente (/teacher/*), esta barra DESAPARECE
          para dar una experiencia idéntica a la del docente real.
          ═══════════════════════════════════════════════════════════════════════ */}
      {esVistaAdmin && (
        <nav
          role="navigation"
          aria-label="Barra de Administración"
          style={{
            background: '#1a252f',
            padding: '10px 30px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '15px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            position: 'sticky',
            top: 0,
            zIndex: 1000
          }}
        >
          {/* Identidad del panel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#ecf0f1', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>
              ⚙️ Plugin Feedback — Panel de Administración
            </span>
            <span style={{
              background: '#e74c3c',
              color: '#fff',
              fontSize: '10px',
              fontWeight: '700',
              padding: '2px 7px',
              borderRadius: '10px',
              letterSpacing: '0.5px'
            }}>
              ADMIN
            </span>
          </div>

          {/* Botones de navegación */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              id="admin-nav-administracion"
              title="Ver Panel de Administración"
              style={{
                background: esVistaAdmin ? '#0770a3' : 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                padding: '7px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: esVistaAdmin ? '700' : '400',
                transition: 'background 0.2s'
              }}
              onClick={() => navigate('/admin')}
            >
              ⚙️ Administración
            </button>

            <button
              id="admin-nav-vista-docente"
              title="Ver la interfaz exactamente como la ve un docente"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                padding: '7px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                transition: 'background 0.2s'
              }}
              onClick={() => navigate('/teacher/courses')}
            >
              📋 Vista Docente
            </button>

            <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', height: '24px' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              Admin / Docente
            </span>
          </div>
        </nav>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BOTÓN FLOTANTE "VOLVER A ADMIN" — solo visible en /teacher/*
          Discreto, en la esquina inferior derecha, para no interferir con
          la interfaz del docente que el admin está evaluando.
          ═══════════════════════════════════════════════════════════════════════ */}
      {esVistaDocente && (
        <button
          id="admin-floating-return"
          title="Volver al Panel de Administración"
          onClick={() => navigate('/admin')}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            background: '#1a252f',
            color: '#fff',
            border: '2px solid rgba(255,255,255,0.15)',
            borderRadius: '28px',
            padding: '10px 18px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            transition: 'all 0.2s ease',
            fontFamily: "'Lato', sans-serif",
            letterSpacing: '0.3px'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#2d3b45';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.45)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#1a252f';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.35)';
          }}
        >
          <span style={{ fontSize: '10px', background: '#e74c3c', borderRadius: '8px', padding: '1px 6px' }}>
            ADMIN
          </span>
          ← Volver a Admin
        </button>
      )}

      {/* Contenido principal — <Outlet /> renderiza la ruta activa */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  );
}
