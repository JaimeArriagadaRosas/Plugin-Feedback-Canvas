// frontend/src/components/SidebarNavigation.jsx - Side navigation
import React from 'react';

const SidebarNavigation = ({ activeView, onNavigate }) => {
  const menuItems = [
    { id: 'speedgrader', label: '📝 Revisión', icon: '📝' },
    { id: 'templates', label: '📋 Plantillas', icon: '📋' },
    { id: 'reports', label: '📊 Reportes', icon: '📊' },
    { id: 'student', label: '👤 Vista Estudiante', icon: '👤', role: 'student' },
    { id: 'admin', label: '⚙️ Admin', icon: '⚙️', role: 'admin' }
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <img src="/static/logo.png" alt="UNIDA" className="logo" />
        <span>Feedback Plugin</span>
      </div>
      
      <ul className="menu">
        {menuItems.map(item => (
          <li key={item.id}>
            <button
              className={activeView === item.id ? 'active' : ''}
              onClick={() => onNavigate(item.id)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <a href={`${process.env.CANVAS_URL}/courses/${process.env.COURSE_ID}`} target="_blank" rel="noopener noreferrer">
          🔗 Volver a Canvas
        </a>
      </div>
    </nav>
  );
};

export default SidebarNavigation;
