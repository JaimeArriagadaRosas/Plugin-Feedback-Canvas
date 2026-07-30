import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Barra de Navegación de Administración
 * Extraída en su propio módulo. Solo debe mostrarse si la vista actual es de administrador.
 */
export default function AdminNavbar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const esVistaAdmin = location.pathname.startsWith('/admin') || location.pathname === '/';

  // Seguridad adicional: Si por alguna razón el componente se monta pero
  // no estamos en la vista de admin, no renderizamos nada.
  if (!esVistaAdmin) return null;

  return (
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
  );
}
