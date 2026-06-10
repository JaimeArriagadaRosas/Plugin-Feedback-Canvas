import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import CourseSelector from "./CourseSelector";
import AssignmentList from "./AssignmentList";
import TemplateManagement from "../plantillas/TemplateManagement";
import SpeedGraderPanel from "../speedgrader/SpeedGraderPanel";
import FeedbackReviewPanel from "../feedback/FeedbackReviewPanel";
import FeedbackDetailView from "../feedback/FeedbackDetailView";
import StudentFeedbackView from "../feedback/StudentFeedbackView";
import AdminPanel from "../admin/AdminPanel";

export default function ConfigurationWizard({ onApiError }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const [role, setRole] = useState(null);

  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    const fetchConfig = () => {
      fetch('/api/config/startup-mode')
        .then(r => r.json())
        .then(modeData => {
          if (modeData.initializing) {
            setInitializing(true);
            setTimeout(fetchConfig, 3000);
          } else {
            setInitializing(false);
            fetch('/api/config/me')
              .then(r => r.json())
              .then(data => {
                if (data.exito && data.role) {
                  setRole(data.role);
                } else {
                  setRole('teacher');
                }
              })
              .catch(() => setRole('teacher'));
          }
        })
        .catch(() => {
          setTimeout(fetchConfig, 3000);
        });
    };
    fetchConfig();
  }, []);

  const handleLogout = () => {
    fetch('/api/config/clear-mock-role', { method: 'POST' })
      .then(() => {
        window.location.href = '/';
      });
  };

  const dropdownItemStyle = {
    background: "none",
    border: "none",
    borderBottom: "1px solid #eee",
    color: "#2d3b45",
    padding: "12px 20px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "13px",
    transition: "background 0.2s",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%"
  };

  if (initializing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f5f5", fontFamily: "sans-serif" }}>
        <h2>Inicializando Canvas LMS Local...</h2>
        <p>Esto puede tomar unos minutos la primera vez. Por favor, espera.</p>
      </div>
    );
  }

  if (!role) return <div>Cargando sesión...</div>;

  return (
    <div className="feedback-plugin-container" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Top Navigation with Three-Dot Dropdown */}
      <div style={{ background: "#2d3b45", padding: "5px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        
        <button
          style={{
            background: "none", border: "none", color: "#fff", cursor: "pointer",
            fontSize: "13px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px"
          }}
          onClick={() => navigate(-1)}
        >
          {location.pathname !== '/' && location.pathname !== '/student' && location.pathname !== '/admin' && "← Volver"}
        </button>
        
        {role !== 'student' && (
          <button
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "24px", padding: "5px 10px", borderRadius: "4px" }}
            onClick={() => setShowMenu(!showMenu)}
            onBlur={() => setTimeout(() => setShowMenu(false), 200)}
            title="Menú de opciones"
          >
            ⋮
          </button>
        )}

        {showMenu && role !== 'student' && (
          <div style={{
            position: "absolute", top: "100%", right: "30px", background: "#fff",
            border: "1px solid #c7cdd1", borderRadius: "4px", boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            zIndex: 2000, width: "220px", display: "flex", flexDirection: "column", marginTop: "5px"
          }}>
            {(role === 'admin' || role === 'teacher') && (
              <button style={dropdownItemStyle} onClick={() => navigate('/admin')}>
                <span>⚙️</span> Administración
              </button>
            )}
            <button style={dropdownItemStyle} onClick={() => navigate('/teacher/courses')}>
              <span>📋</span> Panel Docente
            </button>
            <button style={{ ...dropdownItemStyle, borderBottom: "none", color: "#e74c3c" }} onClick={handleLogout}>
              <span>🚪</span> Salir de Bypass
            </button>
          </div>
        )}
      </div>

      <Routes>
        <Route path="/" element={<Navigate to={role === 'student' ? '/student' : role === 'admin' ? '/admin' : '/teacher/courses'} replace />} />
        
        <Route path="/admin" element={<AdminPanel onExit={() => navigate('/')} />} />
        <Route path="/student" element={<StudentFeedbackView onExit={() => navigate('/')} />} />
        
        <Route path="/teacher/courses" element={<CourseSelector onCourseSelected={(c) => navigate(`/teacher/assignments/${c.id}`, { state: { course: c } })} onApiError={onApiError} />} />
        <Route path="/teacher/assignments/:courseId" element={<AssignmentList course={location.state?.course || {id: location.pathname.split('/').pop(), name: 'Curso Seleccionado'}} onBack={() => navigate('/teacher/courses')} onNext={() => navigate(`/teacher/templates/${location.pathname.split('/').pop()}/1`)} />} />
        <Route path="/teacher/templates/:courseId/:assignmentId" element={<TemplateManagement onBack={() => navigate(-1)} onNext={() => navigate(`/teacher/config-ready/${location.pathname.split('/')[3]}/${location.pathname.split('/')[4]}`)} />} />
        
        <Route path="/teacher/config-ready/:courseId/:assignmentId" element={
          <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
            <h2>Configurar Feedback</h2>
            <p>La configuración para esta tarea está lista.</p>
            <div style={{ marginTop: "30px", display: "flex", justifyContent: "center", gap: "20px" }}>
              <button
                style={{ padding: "10px 20px", background: "#fff", border: "1px solid #c7cdd1", borderRadius: "4px", cursor: "pointer" }}
                onClick={() => navigate(-1)}
              >
                Volver a Plantillas
              </button>
              <button
                style={{ padding: "10px 20px", background: "#0770a3", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                onClick={() => navigate('/teacher/speedgrader')}
              >
                🚀 Lanzar Integración SpeedGrader (RF16)
              </button>
            </div>
          </div>
        } />
        
        <Route path="/teacher/speedgrader" element={<SpeedGraderPanel onExit={() => navigate(-1)} />} />
        <Route path="/teacher/review" element={<FeedbackReviewPanel onEditFeedback={(fb) => navigate(`/teacher/review/detail/${fb.id}`)} />} />
        <Route path="/teacher/review/detail/:feedbackId" element={<FeedbackDetailView onBack={() => navigate('/teacher/review')} />} />
      </Routes>
    </div>
  );
}
