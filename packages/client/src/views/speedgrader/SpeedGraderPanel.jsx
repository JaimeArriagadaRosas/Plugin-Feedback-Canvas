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
import SpeedGraderHeader from './SpeedGraderHeader';
import AIControls from './AIControls';
import SpeedGraderRubric from './SpeedGraderRubric';
import ErrorBoundary from '../../app/ErrorBoundary';
import RubricModal from '../components/RubricModal';
import styles from './SpeedGraderPanel.module.css';

export default function SpeedGraderPanel({ onExit }) {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRubricModal, setShowRubricModal] = useState(false);
  const taskSelectorRef = useRef(null);

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

  const maxPoints = activeAssignment?.points;
  const percent = maxPoints > 0 ? grade / maxPoints : 0;
  const scaledGrade = percent < 0.6 
    ? 3 * (percent / 0.6) + 1 
    : 3 * ((percent - 0.6) / 0.4) + 4;
    
  const hasSubmitted = submission && submission.workflow_state !== 'unsubmitted' && !submission.missing;

  let gradeRange = 'Rango Bajo';
  if (!hasSubmitted) {
    gradeRange = '-';
  } else if (scaledGrade >= 6.0) {
    gradeRange = 'Rango Alto';
  } else if (scaledGrade >= 4.0) {
    gradeRange = 'Rango Medio';
  }

  let templateName = 'Sin plantilla activada';
  if (!hasSubmitted) {
    templateName = 'Sin plantilla';
  } else if (activeAssignment?.templateName) {
    templateName = `${activeAssignment.templateName} - ${gradeRange}`;
  }

  return (
    <ErrorBoundary>
      <div className={styles.wrapper}>

      <SpeedGraderHeader 
        onBack={handleBack} 
        onShowTutorial={() => setShowTutorial(true)} 
      />

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} />}
      {showRubricModal && (
        <RubricModal 
          rubric={activeAssignment?.rubric} 
          onClose={() => setShowRubricModal(false)} 
        />
      )}

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
              <span className={styles.gradeValue}>{isFetchingSubmission ? '...' : grade} pts</span>
              {maxPoints != null && (
                <>
                  <span className={styles.gradeSeparator}>/</span>
                  <span className={styles.gradeMax}>{maxPoints} pts</span>
                </>
              )}
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
          <SpeedGraderRubric 
            onShowHistory={() => setShowHistory(true)} 
            grade={grade} 
            hasRubric={!!activeAssignment?.rubric}
            onShowRubric={() => setShowRubricModal(true)}
          />

          <AIControls
            feedback={feedback}
            loading={loading}
            generatedFeedbackId={generatedFeedbackId}
            rating={rating}
            setRating={setRating}
            handleGenerate={handleGenerate}
            handleApprove={handleApprove}
          />
        </div>
      </main>

      </div>
    </ErrorBoundary>
  );
}