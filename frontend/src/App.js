// frontend/src/App.js - Main App component
import React, { useState, useEffect } from 'react';
import { useLTI } from './components/LTIContext';
import CanvasThemeWrapper from './components/CanvasThemeWrapper';
import SpeedGraderPanel from './components/SpeedGraderPanel';
import TemplateManager from './components/TemplateManager';
import AdminPanel from './components/AdminPanel';
import ReportsPanel from './components/ReportsPanel';
import StudentView from './components/StudentView';
import SidebarNavigation from './components/SidebarNavigation';
import './styles/main.css';

function App() {
  const { user, context, tokenValid, loading } = useLTI();
  const [activeView, setActiveView] = useState('speedgrader');
  const [refreshFlag, setRefreshFlag] = useState(0);

  if (loading) {
    return (
      <CanvasThemeWrapper>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando plugin de feedback...</p>
        </div>
      </CanvasThemeWrapper>
    );
  }

  if (!tokenValid) {
    return (
      <CanvasThemeWrapper>
        <div className="error-container">
          <h2>⚠️ Error de autenticación</h2>
          <p>No se pudo validar tu sesión con Canvas. Por favor, recarga la página o contacta al administrador.</p>
        </div>
      </CanvasThemeWrapper>
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'speedgrader':
        return <SpeedGraderPanel key={refreshFlag} />;
      case 'templates':
        return <TemplateManager />;
      case 'reports':
        return <ReportsPanel />;
      case 'admin':
        return user?.role === 'admin' ? <AdminPanel /> : <div>Acceso denegado</div>;
      case 'student':
        return user?.role === 'student' ? <StudentView /> : <div>Acceso denegado</div>;
      default:
        return <SpeedGraderPanel />;
    }
  };

  return (
    <CanvasThemeWrapper>
      <div className="feedback-plugin-app">
        <header className="plugin-header">
          <div className="header-left">
            <h1>Feedback Adaptativo UNIDA</h1>
            {context.assignmentTitle && (
              <span className="context-info">
                {context.assignmentTitle} • {context.courseTitle}
              </span>
            )}
          </div>
          <div className="header-right">
            <span className="user-info">
              👤 {user?.name || 'Usuario'}
            </span>
            <span className="role-badge role-{user?.role}">
              {user?.role === 'teacher' ? 'Profesor' : 
               user?.role === 'admin' ? 'Administrador' : 'Estudiante'}
            </span>
          </div>
        </header>

        <div className="plugin-body">
          <SidebarNavigation activeView={activeView} onNavigate={setActiveView} />
          
          <main className="plugin-content">
            {renderView()}
          </main>
        </div>
      </div>
    </CanvasThemeWrapper>
  );
}

export default App;
