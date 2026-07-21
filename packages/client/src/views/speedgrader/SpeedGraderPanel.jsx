import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useSpeedGraderData } from './hooks/useSpeedGraderData';
import SubmissionViewer from './SubmissionViewer';
import FeedbackActions from './FeedbackActions';
import { useSpeedGraderActions } from './hooks/useSpeedGraderActions';
import WizardProgress from '../cursos/WizardProgress';
import TutorialModal from '../components/TutorialModal';
import styles from './SpeedGraderPanel.module.css';

export default function SpeedGraderPanel({ onExit }) {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);
  const menuRef = useRef(null);
  const taskSelectorRef = useRef(null);

  // Cierra el menú Opciones al hacer clic fuera
  useEffect(() => {
    if (!menuOpen) return;
    function handleOut(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOut);
    return () => document.removeEventListener('mousedown', handleOut);
  }, [menuOpen]);

  // Cierra el selector de tarea al hacer clic fuera
  useEffect(() => {
    if (!taskSelectorOpen) return;
    function handleClickOutside(e) {
      if (taskSelectorRef.current && !taskSelectorRef.current.contains(e.target)) setTaskSelectorOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [taskSelectorOpen]);
  const {
    courseId,
    assignments,
    students,
    currentAssignmentId,
    setCurrentAssignmentId,
    currentIndex,
    setCurrentIndex,
    grade,
    setGrade,
    loading,
    setLoading,
    statusMsg,
    setStatusMsg,
    currentStudent,
    submissionText,
    activeAssignment,
    feedback,
    setFeedback,
    generatedFeedbackId,
    setGeneratedFeedbackId,
  } = useSpeedGraderData();

  const logExit = useButtonLogger();

  const { handleGenerate, handleApprove, handleExit } = useSpeedGraderActions({
    courseId,
    currentAssignmentId,
    currentStudent,
    students,
    grade,
    feedback,
    generatedFeedbackId,
    setLoading,
    setStatusMsg,
    setFeedback,
    setGeneratedFeedbackId,
    onExit,
    logExit
  });

  const handleBack = useCallback(() => {
    navigate(`/teacher/templates/${courseId}/${currentAssignmentId}`);
  }, [navigate, courseId, currentAssignmentId]);

  // Neutraliza el paddingBottom del main#main-content del layout padre
  // para que el SpeedGrader ocupe el alto completo sin barra gris inferior
  useEffect(() => {
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
      const prev = mainEl.style.paddingBottom;
      mainEl.style.paddingBottom = '0';
      mainEl.style.overflow = 'hidden';
      return () => {
        mainEl.style.paddingBottom = prev;
        mainEl.style.overflow = '';
      };
    }
  }, []);

  const gradeRange = grade >= 6 ? 'Logrado (6-10)' : grade >= 4 ? 'En desarrollo (4-5.9)' : 'No logrado (0-3.9)';
  const templateName = generatedFeedbackId ? 'Feedback detallado ISW-II' : 'Sin plantilla activada';

  return (
    <div className={styles.wrapper}>

      <header className={styles.header}>
        <button className={styles.backButton} onClick={handleBack}>
          ← Volver
        </button>

        {/* Botón Opciones con dropdown */}
        <div ref={menuRef} className={styles.headerMenu}>
          <button
            className={styles.backButton}
            onClick={() => setMenuOpen(o => !o)}
          >
            Opciones
          </button>
          {menuOpen && (
            <div className={styles.headerDropdown}>
              <button
                className={styles.headerDropdownItem}
                onClick={() => { setMenuOpen(false); navigate('/teacher/review'); }}
              >
                📋 Revisión de Feedbacks
              </button>
              <button
                className={styles.headerDropdownItem}
                onClick={() => { setMenuOpen(false); setShowTutorial(true); }}
              >
                🎥 Tutorial
              </button>
            </div>
          )}
        </div>
      </header>

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <main className={styles.main}>
        <div className={styles.leftColumn}>

          {/* Selector de tarea — encima de la fila de estudiante */}
          {assignments.length > 0 && (
            <div ref={taskSelectorRef} className={styles.taskSelectorBar}>
              <span className={styles.taskSelectorBarLabel}>Tarea:</span>
              <div className={styles.taskSelectorWrap}>
                <button
                  className={styles.taskSelectorBtn}
                  onClick={() => setTaskSelectorOpen(o => !o)}
                  title="Cambiar tarea visualizada"
                >
                  <span className={styles.taskSelectorIcon}>📋</span>
                  <span className={styles.taskSelectorLabel}>
                    {activeAssignment.name || 'Seleccionar tarea'}
                  </span>
                  <span className={styles.taskSelectorCaret}>{taskSelectorOpen ? '▲' : '▼'}</span>
                </button>
                {taskSelectorOpen && (
                  <div className={styles.taskDropdown}>
                    <div className={styles.taskDropdownHeader}>Tareas disponibles</div>
                    {assignments.map(a => (
                      <button
                        key={a.id}
                        className={`${styles.taskDropdownItem} ${a.id === currentAssignmentId ? styles.taskDropdownItemActive : ''}`}
                        onClick={() => {
                          setCurrentAssignmentId(a.id);
                          setCurrentIndex(0);
                          setGeneratedFeedbackId(null);
                          setTaskSelectorOpen(false);
                        }}
                      >
                        {a.id === currentAssignmentId && <span className={styles.taskCheck}>✓</span>}
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={styles.submissionHeader}>
            <div className={styles.submissionHeaderLeft}>
              <h2 className={styles.submissionTitle}>{activeAssignment.name}</h2>
              <p className={styles.submissionStudent}>Estudiante: <strong>{currentStudent.name}</strong></p>
            </div>
            <div className={styles.submissionHeaderRight}>
              <button
                className={styles.navButton}
                onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                ‹ Anterior
              </button>
              <span className={styles.currentStudentName}>{currentStudent.name}</span>
              <button
                className={styles.navButton}
                onClick={() => currentIndex < students.length - 1 && setCurrentIndex(currentIndex + 1)}
                disabled={currentIndex === students.length - 1}
              >
                Siguiente ›
              </button>
            </div>
          </div>

          <SubmissionViewer
            submissionText={submissionText}
          />
        </div>

        <div className={styles.rightColumn}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Calificación y comentarios</h3>
            <div className={styles.gradeDisplay}>
              <span className={styles.gradeValue}>{grade}</span>
              <span className={styles.gradeSeparator}>/</span>
              <span className={styles.gradeMax}>{activeAssignment.points}</span>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Configuración detectada</h3>
            <div className={styles.configRow}>
              <span className={styles.configLabel}>Rango de nota:</span>
              <span className={styles.configValue}>{gradeRange}</span>
            </div>
            <div className={styles.configRow}>
              <span className={styles.configLabel}>Plantilla activada:</span>
              <span className={styles.configValue}>{templateName}</span>
            </div>
          </section>

          {/* Botones de acción: Rúbrica, Ver Historial, Simular Trayectoria */}
          <div className={styles.actionButtons}>
            <button className={styles.actionBtn}>■ Rúbrica</button>
            <button className={styles.actionBtn}>Ver Historial</button>
            <button className={styles.actionBtn}>
              Simular Trayectoria: {grade >= 6 ? 'ALTA' : 'BAJA'}
              <span className={styles.trajectoryBadge}>
                {grade >= 6 ? '(Regresión)' : '(Mejora)'}
              </span>
            </button>
          </div>

          {/* Panel de feedback adaptativo */}
          <section className={styles.feedbackAdaptivePanel}>
            <div className={styles.feedbackAdaptiveHeader}>
              UNIDA FEEDBACK ADAPTATIVO (IA)
            </div>
            <div className={styles.feedbackAdaptiveBody}>
              {feedback ? (
                <>
                  <div className={styles.feedbackTag}>FEEDBACK PARA TRAYECTORIA DE MEJORA</div>
                  <div className={styles.feedbackAdaptiveText}>{feedback}</div>
                </>
              ) : (
                <div className={styles.feedbackPlaceholder}>
                  Aquí se visualizará la review del feedback generado para el estudiante.
                </div>
              )}
            </div>
          </section>

          <FeedbackActions
            loading={loading}
            generatedFeedbackId={generatedFeedbackId}
            feedback={feedback}
            rating={rating}
            setRating={setRating}
            handleGenerate={handleGenerate}
            handleApprove={handleApprove}
          />
        </div>
      </main>

    </div>
  );
}