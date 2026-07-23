import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useSpeedGraderData } from './hooks/useSpeedGraderData';
import SubmissionViewer from './SubmissionViewer';
import FeedbackActions from './FeedbackActions';
import { useSpeedGraderActions } from './hooks/useSpeedGraderActions';
import WizardProgress from '../cursos/WizardProgress';
import TutorialModal from '../components/TutorialModal';
import HistoryModal from '../components/HistoryModal';
import styles from './SpeedGraderPanel.module.css';

export default function SpeedGraderPanel({ onExit }) {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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
    submission,
    activeAssignment,
    feedback,
    setFeedback,
    generatedFeedbackId,
    setGeneratedFeedbackId,
    isFetchingSubmission,
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

  const maxPoints = activeAssignment?.points || 100;
  const percent = maxPoints > 0 ? grade / maxPoints : 0;
  const scaledGrade = percent < 0.6 
    ? 3 * (percent / 0.6) + 1 
    : 3 * ((percent - 0.6) / 0.4) + 4;
    
  let gradeRange = 'Rango Bajo (1.0 - 3.9)';
  if (scaledGrade >= 6.0) {
    gradeRange = 'Rango Alto (6.0 - 7.0)';
  } else if (scaledGrade >= 4.0) {
    gradeRange = 'Rango Medio (4.0 - 5.9)';
  }

  const templateName = activeAssignment?.templateName 
    ? `${activeAssignment.templateName} - ${gradeRange}` 
    : 'Sin plantilla activada';

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
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}

      <main className={styles.main}>
        <div className={styles.leftColumn}>

          <div className={styles.submissionHeader}>
            <div className={styles.submissionHeaderLeft}>
              <p className={styles.submissionStudent}>
                Tarea:{' '}
                <select 
                  className={styles.studentSelectLeft}
                  value={currentAssignmentId || ''}
                  onChange={(e) => {
                    const newId = Number(e.target.value);
                    setCurrentAssignmentId(newId);
                    setCurrentIndex(0);
                    setGeneratedFeedbackId(null);
                  }}
                  style={{ minWidth: '200px' }}
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                  {assignments.length === 0 && (
                    <option value="">Sin Tarea</option>
                  )}
                </select>
              </p>
            </div>
            <div className={styles.submissionHeaderRight}>
              <button
                className={styles.navButton}
                onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                ‹ Anterior
              </button>
              <select 
                className={styles.studentSelectCenter}
                value={currentIndex}
                onChange={(e) => setCurrentIndex(Number(e.target.value))}
              >
                {students.map((student, idx) => (
                  <option key={student.id} value={idx}>
                    {student.name}
                  </option>
                ))}
                {students.length === 0 && (
                  <option value={0}>Sin Estudiante</option>
                )}
              </select>
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
            submission={submission}
            studentName={currentStudent.name}
            assignmentName={activeAssignment.name}
          />
        </div>

        <div className={styles.rightColumn}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Calificación y comentarios</h3>
            <div className={styles.gradeDisplay}>
              <span className={styles.gradeValue}>{isFetchingSubmission ? '...' : grade}</span>
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
            <button className={styles.actionBtn} onClick={() => setShowHistory(true)}>Ver Historial</button>
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