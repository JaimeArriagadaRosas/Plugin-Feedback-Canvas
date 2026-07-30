import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLogger } from '../../hooks/useLogger';
import { usePopover } from '../../hooks/usePopover';
import TutorialModal from './TutorialModal';

export default function UserMenu({ mode = 'fixed' }) {
  const [showTutorial, setShowTutorial] = useState(false);
  const { isOpen, ref: menuRef, toggle: toggleMenuState, close: closeMenu } = usePopover();
  
  const { role, rawRoles, selectedCourse } = useAuth();
  const { logClick } = useLogger();
  const navigate = useNavigate();
  const location = useLocation();

  const isTrueAdmin = role === 'admin' || (rawRoles && rawRoles.some(r => r.includes('Administrator')));



  // No mostrar el menÃº Kebab si estamos en el panel de administraciÃ³n
  // ni en el SpeedGrader (tiene su propio menÃº inline)
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/teacher/speedgrader')) {
    return null;
  }

  const toggleMenu = () => {
    toggleMenuState();
    if (!isOpen) {
      logClick('USER_MENU_OPEN');
    }
  };

  const handleTutorialClick = () => {
    logClick('TUTORIAL_OPEN');
    closeMenu();
    setShowTutorial(true);
  };

  const handleAdminPanelClick = () => {
    logClick('ADMIN_PANEL_NAVIGATE');
    closeMenu();
    navigate('/admin');
  };

  return (
    <>
      <div 
        ref={menuRef}
        style={{
          position: mode === 'anchored' ? 'absolute' : 'fixed',
          top: '15px',
          right: '20px',
          zIndex: 9999,
          fontFamily: "'Lato', sans-serif"
        }}
      >
        <button
          onClick={toggleMenu}
          title="MenÃº de opciones"
          style={{
            background: '#ffffff',
            color: '#2d3b45',
            border: '1px solid #c7cdd1',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            transition: 'background 0.2s ease',
            lineHeight: 1
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
          onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
        >
          &#8942;
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '45px',
            right: 0,
            background: '#fff',
            border: '1px solid #c7cdd1',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '220px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {isTrueAdmin && (
              <button 
                onClick={handleAdminPanelClick}
                style={menuItemStyle}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f4f7'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span>🛡️</span> Panel de Administración
              </button>
            )}

            {(role === 'teacher' || role === 'admin') && !location.pathname.startsWith('/teacher/review') && (
              <button 
                onClick={() => { closeMenu(); navigate('/teacher/review', { state: { course: selectedCourse } }); }}
                style={{
                  ...menuItemStyle,
                  borderTop: isTrueAdmin ? '1px solid #eee' : 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f4f7')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
              >
                <span>📋</span> Revisión de Feedbacks
              </button>
            )}

            {location.pathname.startsWith('/teacher/review') && (
              <button 
                onClick={() => { closeMenu(); navigate('/teacher/courses'); }}
                style={{
                  ...menuItemStyle,
                  borderTop: isTrueAdmin ? '1px solid #eee' : 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f4f7'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span>↩️</span> Volver
              </button>
            )}
            
            <button 
              onClick={handleTutorialClick}
              style={{
                ...menuItemStyle,
                borderTop: (isTrueAdmin || role === 'teacher') ? '1px solid #eee' : 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f4f7'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <span>🎥</span> Tutorial
            </button>
          </div>
        )}
      </div>

      {showTutorial && (
        <TutorialModal onClose={() => setShowTutorial(false)} />
      )}
    </>
  );
}

const menuItemStyle = {
  padding: '12px 16px',
  background: '#fff',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '14px',
  color: '#2d3b45',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  transition: 'background 0.2s ease',
  width: '100%',
  fontFamily: "'Lato', sans-serif"
};
