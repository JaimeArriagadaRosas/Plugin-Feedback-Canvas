import { useState } from "react";
import MockCourseSelector from "./MockCourseSelector";
import AssignmentList from "../vista/cursos/AssignmentList";
import TemplateManagement from "../vista/plantillas/TemplateManagement";
import FeedbackReviewPanel from "../vista/feedback/FeedbackReviewPanel";
import AdminPanel from "../vista/admin/AdminPanel";
import StudentFeedbackView from "../vista/feedback/StudentFeedbackView";
import SpeedGraderPanel from "../vista/speedgrader/SpeedGraderPanel";

const styles = {
  topNav: {
    background: "#2d3b45",
    padding: "5px 30px",
    display: "flex",
    justifyContent: "flex-end",
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

export default function MockConfigurationWizard({ onStudentViewChange }) {
  const [step, setStep] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [view, setView] = useState("wizard"); // "wizard", "review", "admin", "student"
  const [showMenu, setShowMenu] = useState(false);

  const handleCourseSelected = (course) => {
    setSelectedCourse(course);
    setStep(1);
  };

  const backToWizard = () => {
    setView("wizard");
    if (onStudentViewChange) onStudentViewChange(false);
  };

  const navigateTo = (newView) => {
    setView(newView);
    setShowMenu(false);
    if (onStudentViewChange) {
      onStudentViewChange(newView === "student");
    }
  };

  if (view === "admin") return <AdminPanel onExit={backToWizard} />;
  if (view === "review") return <FeedbackReviewPanel onBack={backToWizard} />;
  if (view === "student") return <StudentFeedbackView onExit={backToWizard} />;

  return (
    <div className="feedback-plugin-mock-container" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={styles.topNav}>
        <span style={{ color: "#8899a6", fontSize: 11, marginRight: "auto" }}>MODO MOCKUP ACTIVO</span>
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

      {step === 0 && <MockCourseSelector onCourseSelected={handleCourseSelected} />}
      {step === 1 && <AssignmentList course={selectedCourse} onBack={() => { setStep(0); setSelectedCourse(null); }} onNext={() => setStep(2)} />}
      {step === 2 && <TemplateManagement onBack={() => setStep(1)} onNext={() => setStep(3)} />}
      {step === 3 && <SpeedGraderPanel onExit={() => setStep(2)} />}
    </div>
  );
}
