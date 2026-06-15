import { useState } from "react";
import LocalCourseSelector from "./LocalCourseSelector";
import AssignmentList from "../vista/cursos/AssignmentList";
import TemplateManagement from "../vista/plantillas/TemplateManagement";
import FeedbackReviewPanel from "../vista/feedback/FeedbackReviewPanel";
import FeedbackDetailView from "../vista/feedback/FeedbackDetailView";
import AdminPanel from "../vista/admin/AdminPanel";
import StudentFeedbackView from "../vista/feedback/StudentFeedbackView";
import SpeedGraderPanel from "../vista/speedgrader/SpeedGraderPanel";

const styles = {
  topNav: {
    background: "#2d3b45",
    padding: "5px 30px",
    display: "flex",
    justifyContent: "space-between",
    position: "relative",
    alignItems: "center"
  },
  menuBtn: {
    background: "none",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: "24px",
    padding: "5px 10px",
    borderRadius: "4px"
  },
  dropdown: {
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
  },
  dropdownItem: {
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
  }
};

export default function LocalConfigurationWizard({ onStudentViewChange }) {
  const [step, setStep] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [view, setView] = useState("wizard"); // "wizard", "review", "detail", "admin", "student"
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleCourseSelected = (course) => {
    setSelectedCourse(course);
    setStep(1);
  };

  const backToWizard = () => {
    setView("wizard");
    if (onStudentViewChange) onStudentViewChange(false);
  };

  const backToReview = () => {
    setView("review");
  };

  const openDetailView = (fb) => {
    setCurrentFeedback(fb);
    setView("detail");
  };

  const navigateTo = (newView) => {
    setView(newView);
    setShowMenu(false);
    if (onStudentViewChange) {
      onStudentViewChange(newView === "student");
    }
  };

  return (
    <div className="feedback-plugin-local-container" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ ...styles.topNav, justifyContent: view !== "wizard" ? "space-between" : "flex-end" }}>
        {view !== "wizard" ? (
          <button
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "bold"
            }}
            onClick={backToWizard}
          >
            ← Volver al Asistente
          </button>
        ) : (
          <span style={{ color: "#8899a6", fontSize: 11, marginRight: "auto" }}>MODO LOCAL ACTIVO</span>
        )}
        
        <button
          style={styles.menuBtn}
          onClick={() => setShowMenu(!showMenu)}
          onBlur={() => setTimeout(() => setShowMenu(false), 200)}
        >
          ⋮
        </button>

        {showMenu && (
          <div style={styles.dropdown}>
            <button style={styles.dropdownItem} onClick={() => navigateTo("admin")}>
              <span>⚙️</span> Administración
            </button>
            <button style={styles.dropdownItem} onClick={() => navigateTo("review")}>
              <span>📋</span> Panel de Revisión
            </button>
            <button style={{ ...styles.dropdownItem, borderBottom: "none" }} onClick={() => navigateTo("student")}>
              <span>🎓</span> Vista Estudiante
            </button>
          </div>
        )}
      </div>

      {view === "admin" && <AdminPanel onExit={backToWizard} />}
      {view === "review" && <FeedbackReviewPanel onEditFeedback={openDetailView} />}
      {view === "detail" && <FeedbackDetailView feedback={currentFeedback} onBack={backToReview} />}
      {view === "student" && <StudentFeedbackView onExit={backToWizard} />}

      {view === "wizard" && (
        <>
          {step === 0 && <LocalCourseSelector onCourseSelected={handleCourseSelected} />}
          {step === 1 && <AssignmentList course={selectedCourse} onBack={() => { setStep(0); setSelectedCourse(null); }} onNext={() => setStep(2)} />}
          {step === 2 && <TemplateManagement onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && <SpeedGraderPanel onExit={() => setStep(2)} />}
        </>
      )}
    </div>
  );
}
