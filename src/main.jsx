import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ConfigurationWizard from './vista/cursos/ConfigurationWizard'
import MockAppWrapper from './mockups/MockAppWrapper'

function RestrictedAccessBypass() {
  const [loading, setLoading] = useState(false);

  const handleBypass = async (role) => {
    setLoading(true);
    try {
      const response = await fetch('/api/config/set-mock-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (response.ok) {
        // Reload page to re-initialize AppRoot with dev-token active
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: "60px 40px", 
      fontFamily: "'Lato', sans-serif", 
      textAlign: "center",
      background: "#fdfefe",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        maxWidth: "600px",
        background: "#ffffff",
        border: "1px solid #c7cdd1",
        borderRadius: "8px",
        padding: "40px",
        boxShadow: "0 4px 15px rgba(0,0,0,0.08)"
      }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>🔒</div>
        <h2 style={{ color: "#c0392b", fontSize: "24px", fontWeight: "700", margin: "0 0 10px 0" }}>
          Acceso LTI Restringido
        </h2>
        <p style={{ color: "#2d3b45", fontSize: "15px", lineHeight: "1.6", margin: "0 0 20px 0" }}>
          No se detectó una sesión LTI válida. El plugin de feedback adaptativo debe iniciarse de forma nativa e integrada dentro de su curso de Canvas LMS.
        </p>
        
        {import.meta.env.DEV && (
          <div style={{
            marginTop: "30px",
            borderTop: "2px dashed #c7cdd1",
            paddingTop: "30px",
            background: "#fcf8e3",
            borderRadius: "6px",
            padding: "20px"
          }}>
            <h3 style={{ color: "#c09853", fontSize: "16px", margin: "0 0 15px 0", fontWeight: "700" }}>
              🛠️ ENTORNO DE DESARROLLO DETECTADO
            </h3>
            <p style={{ fontSize: "13px", color: "#666", lineHeight: "1.5", margin: "0 0 20px 0" }}>
              Puedes omitir el flujo LTI y probar la interfaz del plugin directamente en tu navegador seleccionando un perfil de desarrollo:
            </p>
            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
              <button 
                onClick={() => handleBypass('teacher')}
                disabled={loading}
                style={{
                  background: "#0770a3",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "13px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "background 0.2s"
                }}
              >
                {loading ? "Cargando..." : "Ingresar como Profesor"}
              </button>
              <button 
                onClick={() => handleBypass('student')}
                disabled={loading}
                style={{
                  background: "#27ae60",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "13px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  transition: "background 0.2s"
                }}
              >
                {loading ? "Cargando..." : "Ingresar como Estudiante"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AppRoot() {
  const [startupMode, setStartupMode] = useState(null);
  const [useMock, setUseMock] = useState(null);

  useEffect(() => {
    fetch('/api/config/startup-mode')
      .then(r => r.json())
      .then(data => {
        setStartupMode(data.mode);
        setUseMock(data.useMock);
      })
      .catch(e => {
        setStartupMode('3');
        setUseMock(true); // Default to mock on error
      });
  }, []);

  if (useMock === null) return <div style={{padding: 40}}>Cargando configuración del entorno...</div>;

  return (
    <React.StrictMode>
      {useMock ? (
        <MockAppWrapper />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path="/*" element={
              document.cookie.includes('lti_token') || document.cookie.includes('dev-token') || startupMode === '2' ? 
              <ConfigurationWizard onApiError={() => setStartupMode('3')} /> :
              <RestrictedAccessBypass />
            } />
          </Routes>
        </BrowserRouter>
      )}
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
