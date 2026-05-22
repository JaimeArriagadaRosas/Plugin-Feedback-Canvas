import { useState } from "react";
import CourseSelector from "./CourseSelector";
import AssignmentList from "./AssignmentList";
import TemplateManagement from "../plantillas/TemplateManagement";
import SpeedGraderPanel from "../speedgrader/SpeedGraderPanel";
import FeedbackReviewPanel from "../feedback/FeedbackReviewPanel";
import FeedbackDetailView from "../feedback/FeedbackDetailView";
import StudentFeedbackView from "../feedback/StudentFeedbackView";
import AdminPanel from "../admin/AdminPanel";

export default function ConfigurationWizard({ onApiError }) {
  const [step, setStep] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [view, setView] = useState("wizard"); // "wizard", "review", "detail", "student", "admin"
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  // Navigation handlers
  const handleCourseSelected = (course) => {
    setSelectedCourse(course);
    setStep(1); // Go to Assignment List
  };

  const handleBackToCourses = () => {
    setStep(0);
    setSelectedCourse(null);
  };

  const handleNextToTemplates = () => setStep(2);
  const handleBackToAssignments = () => setStep(1);

  const handleNextToConfigReady = () => setStep(3);
  const handleBackToTemplates = () => setStep(2);

  const handleLaunchSpeedGrader = () => setStep(4);

  const openReviewPanel = () => setView("review");
  const openDetailView = (fb) => {
    setCurrentFeedback(fb);
    setView("detail");
  };
  const openStudentView = () => setView("student");
  const openAdminPanel = () => setView("admin");
  const backToReview = () => setView("review");
  const backToWizard = () => setView("wizard");

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

  return (
    <div className="feedback-plugin-container" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Top Navigation with Three-Dot Dropdown */}
      <div style={{ background: "#2d3b45", padding: "5px 30px", display: "flex", justifyContent: view !== "wizard" ? "space-between" : "flex-end", alignItems: "center", position: "relative" }}>
        {view !== "wizard" && (
          <button
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
            onClick={backToWizard}
          >
            ← Volver al Asistente
          </button>
        )}
        
        <button
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "24px", padding: "5px 10px", borderRadius: "4px" }}
          onClick={() => setShowMenu(!showMenu)}
          onBlur={() => setTimeout(() => setShowMenu(false), 200)}
          title="Menú de opciones"
        >
          ⋮
        </button>

        {showMenu && (
          <div style={{
            position: "absolute",
            top: "100%",
            right: "30px",
            background: "#fff",
            border: "1px solid #c7cdd1",
            borderRadius: "4px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            zIndex: 2000,
            width: "220px",
            display: "flex",
            flexDirection: "column",
            marginTop: "5px"
          }}>
            <button
              style={dropdownItemStyle}
              onClick={openAdminPanel}
              onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
              onMouseLeave={(e) => e.target.style.background = "none"}
            >
              <span>⚙️</span> Administración
            </button>
            <button
              style={dropdownItemStyle}
              onClick={openReviewPanel}
              onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
              onMouseLeave={(e) => e.target.style.background = "none"}
            >
              <span>📋</span> Panel de Revisión
            </button>
            <button
              style={{ ...dropdownItemStyle, borderBottom: "none" }}
              onClick={openStudentView}
              onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
              onMouseLeave={(e) => e.target.style.background = "none"}
            >
              <span>🎓</span> Vista Estudiante
            </button>
          </div>
        )}
      </div>

      {view === "review" && (
        <FeedbackReviewPanel onEditFeedback={openDetailView} />
      )}

      {view === "detail" && (
        <FeedbackDetailView feedback={currentFeedback} onBack={backToReview} />
      )}

      {view === "student" && (
        <StudentFeedbackView onExit={backToWizard} />
      )}

      {view === "admin" && (
        <AdminPanel onExit={backToWizard} />
      )}

      {view === "wizard" && (
        <>
          {step === 0 && (
            <CourseSelector
              onCourseSelected={handleCourseSelected}
              userName="Usuario de Canvas"
              onApiError={onApiError}
            />
          )}

          {step === 1 && (
            <AssignmentList
              course={selectedCourse}
              onBack={handleBackToCourses}
              onNext={handleNextToTemplates}
            />
          )}

          {step === 2 && (
            <TemplateManagement 
              onBack={handleBackToAssignments} 
              onNext={handleNextToConfigReady} 
            />
          )}

          {step === 3 && (
            <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
              <h2>Configurar Feedback</h2>
              <p>La configuración para <strong>{selectedCourse?.name}</strong> está lista.</p>
              <div style={{ marginTop: "30px", display: "flex", justifyContent: "center", gap: "20px" }}>
                <button
                  style={{ padding: "10px 20px", background: "#fff", border: "1px solid #c7cdd1", borderRadius: "4px", cursor: "pointer" }}
                  onClick={handleBackToTemplates}
                >
                  Volver a Plantillas
                </button>
                <button
                  style={{ padding: "10px 20px", background: "#0770a3", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                  onClick={handleLaunchSpeedGrader}
                >
                  🚀 Lanzar Integración SpeedGrader (RF16)
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <SpeedGraderPanel onExit={() => setStep(3)} />
          )}
        </>
      )}
    </div>
  );
}
