import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLogger } from '../../hooks/useLogger';
import TutorialModal from './TutorialModal';

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const menuRef = useRef(null);
  
  const { role } = useAuth();
  const { logClick } = useLogger();
  const navigate = useNavigate();
  const location = useLocation();

  // Cerrar el menú si se hace clic afuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // No mostrar el menú Kebab si estamos en el panel de administración
  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  const toggleMenu = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      logClick('USER_MENU_OPEN');
    }
  };

  const handleTutorialClick = () => {
    logClick('TUTORIAL_OPEN');
    setIsOpen(false);
    setShowTutorial(true);
  };

  const handleAdminPanelClick = () => {
    logClick('ADMIN_PANEL_NAVIGATE');
    setIsOpen(false);
    navigate('/admin');
  };

  return (
    <>
      <div 
        ref={menuRef}
        style={{
          position: 'fixed',
          top: '15px',
          right: '20px',
          zIndex: 9999,
          fontFamily: "'Lato', sans-serif"
        }}
      >
        <button
          onClick={toggleMenu}
          title="Menú de opciones"
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
            paddingBottom: '4px' // Ajuste visual del kebab menu
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
          onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
        >
          &#8942; {/* Carácter de tres puntos verticales (Kebab) */}
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
            {role === 'admin' && (
              <button 
                onClick={handleAdminPanelClick}
                style={menuItemStyle}
                onMouseEnter={e => e.currentTarget.style.background = '#f0f4f7'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <span>⚙️</span> Panel de Administración
              </button>
            )}

            {(role === 'teacher' || role === 'admin') && (
              <>
                <button 
                  onClick={() => { setIsOpen(false); navigate('/teacher/review'); }}
                  style={{
                    ...menuItemStyle,
                    borderTop: role === 'admin' ? '1px solid #eee' : 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f4f7'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <span>📋</span> Revisión de Feedbacks
                </button>
                <button 
                  onClick={() => { setIsOpen(false); navigate('/teacher/speedgrader'); }}
                  style={menuItemStyle}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f4f7'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <span>🚀</span> SpeedGrader
                </button>
              </>
            )}
            
            <button 
              onClick={handleTutorialClick}
              style={{
                ...menuItemStyle,
                borderTop: role === 'admin' ? '1px solid #eee' : 'none'
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
