import { useState } from "react";
import CourseSelector from "./CourseSelector";
import AssignmentList from "./AssignmentList";
import TemplateManagement from "../plantillas/TemplateManagement";
import SpeedGraderPanel from "../speedgrader/SpeedGraderPanel";
import FeedbackReviewPanel from "../feedback/FeedbackReviewPanel";
import FeedbackDetailView from "../feedback/FeedbackDetailView";
import StudentFeedbackView from "../feedback/StudentFeedbackView";
import AdminPanel from "../admin/AdminPanel";

export default function ConfigurationWizard() {
  const [step, setStep] = useState(0); 
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [view, setView] = useState("wizard"); // "wizard", "review", "detail", "student", "admin"
  const [currentFeedback, setCurrentFeedback] = useState(null);

  const handleNextFromTemplates = () => setStep(1);
  const handleCourseSelected = (course) => {
    setSelectedCourse(course);
    setStep(2);
  };
  const handleBackToCourses = () => {
    setStep(1);
    setSelectedCourse(null);
  };
  const handleBackToTemplates = () => setStep(0);
  const handleNextToStep3 = () => setStep(3);
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

  if (view === "review") {
    return <FeedbackReviewPanel onEditFeedback={openDetailView} />;
  }

  if (view === "detail") {
    return <FeedbackDetailView feedback={currentFeedback} onBack={backToReview} />;
  }

  if (view === "student") {
    return <StudentFeedbackView onExit={backToWizard} />;
  }

  if (view === "admin") {
    return <AdminPanel onExit={backToWizard} />;
  }

  return (
    <div className="feedback-plugin-container">
      {/* Top Navigation for Different Modes */}
      <div style={{ background: "#2d3b45", padding: "10px 30px", display: "flex", justifyContent: "flex-end", gap: "15px" }}>
        <button 
          style={{ background: "none", border: "1px solid #fff", color: "#fff", padding: "5px 15px", borderRadius: "4px", cursor: "pointer", fontSize: 12 }}
          onClick={openAdminPanel}
        >
          ⚙️ Administración (RF55/56)
        </button>
        <button 
          style={{ background: "none", border: "1px solid #fff", color: "#fff", padding: "5px 15px", borderRadius: "4px", cursor: "pointer", fontSize: 12 }}
          onClick={openReviewPanel}
        >
          📋 Panel de Revisión (RF23)
        </button>
        <button 
          style={{ background: "#0770a3", border: "none", color: "#fff", padding: "5px 15px", borderRadius: "4px", cursor: "pointer", fontSize: 12, fontWeight: "bold" }}
          onClick={openStudentView}
        >
          🎓 Vista Estudiante (RF31)
        </button>
      </div>

      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <TemplateManagement />
          <div style={{ padding: "0 30px 30px", background: "#f5f5f5", textAlign: "right" }}>
            <button 
              style={{ padding: "10px 25px", background: "#0770a3", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
              onClick={handleNextFromTemplates}
            >
              Continuar a Selección de Curso →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <CourseSelector 
            onCourseSelected={handleCourseSelected} 
            userName="Dr. Elena Ramirez"
            lastSync="10:31:05"
          />
          <div style={{ padding: "0 30px 30px", background: "#f5f5f5" }}>
            <button 
              style={{ padding: "8px 15px", background: "#fff", border: "1px solid #c7cdd1", borderRadius: "4px", cursor: "pointer" }}
              onClick={handleBackToTemplates}
            >
              ← Volver a Gestión de Plantillas
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <AssignmentList 
          course={selectedCourse} 
          onBack={handleBackToCourses}
          onNext={handleNextToStep3}
        />
      )}

      {step === 3 && (
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>
          <h2>Step 3: Configure Feedback</h2>
          <p>La configuración para <strong>{selectedCourse?.name}</strong> está lista.</p>
          <div style={{ marginTop: "30px", display: "flex", justifyContent: "center", gap: "20px" }}>
            <button 
              style={{ padding: "10px 20px", background: "#fff", border: "1px solid #c7cdd1", borderRadius: "4px", cursor: "pointer" }} 
              onClick={() => setStep(2)}
            >
              Volver a Tareas
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
    </div>
  );
}
