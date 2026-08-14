import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Administration Navigation Bar
 * Extracted into its own module. Should only be displayed if the current view is administrator.
 */
export default function AdminNavbar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();

  const esVistaAdmin = location.pathname.startsWith('/admin') || location.pathname === '/';

  // Additional security: If for some reason the component mounts but
  // we are not in the admin view, we render nothing.
  if (!esVistaAdmin) return null;

  return (
    <nav
      role="navigation"
      aria-label="Administration Bar"
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
          ⚙️ Feedback Plugin — Administration Panel
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
          title="View Administration Panel"
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
          ⚙️ Administration
        </button>

        <button
          id="admin-nav-vista-docente"
          title="View the interface exactly as a teacher sees it"
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
          📋 Teacher View
        </button>

        <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', height: '24px' }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
          Admin / Teacher
        </span>
      </div>
    </nav>
  );
}
