import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useSpeedGraderData } from './hooks/useSpeedGraderData';
import OptimizeLoadPost from '../../modules/OptimizeLoadPost/OptimizeLoadPost';
import FeedbackActions from './FeedbackActions';
import { useSpeedGraderActions } from './hooks/useSpeedGraderActions';
import WizardProgress from '../cursos/WizardProgress';
import TutorialModal from '../components/TutorialModal';
import HistoryModal from '../components/HistoryModal';
import TrajectoryModal from '../components/TrajectoryModal';
import SpeedGraderHeader from './SpeedGraderHeader';
import AIControls from './AIControls';
import SpeedGraderRubric from './SpeedGraderRubric';
import ErrorBoundary from '../../app/ErrorBoundary';
import RubricModal from '../components/RubricModal';
import styles from './SpeedGraderPanel.module.css';
import SubmissionNavigation from './SubmissionNavigation';
import GradeConfigInfo from './GradeConfigInfo';
import ManualFeedbackPanel from './ManualFeedbackPanel';

export default function SpeedGraderPanel({ onExit }) {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTrajectoryModal, setShowTrajectoryModal] = useState(false);
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
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
    quizDetails,
    isFeedbackApproved,
  } = useSpeedGraderData();

  const logExit = useButtonLogger();

  const { handleGenerateMassive, handleApprove, handleManualSubmit, handleExit } = useSpeedGraderActions({
    courseId,
    currentAssignmentId,
    currentStudent,
    students,
    assignments,
    grade,
    feedback,
    generatedFeedbackId,
    setLoading,
    setStatusMsg,
    setFeedback,
    setGeneratedFeedbackId,
    activeAssignment,
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
    templateName = activeAssignment.templateName;
  }

  return (
    <ErrorBoundary>
      <div className={styles.wrapper}>

      <SpeedGraderHeader 
        courseId={courseId}
        onBack={handleBack} 
        onShowTutorial={() => setShowTutorial(true)} 
      />

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showHistory && <HistoryModal onClose={() => setShowHistory(false)} courseId={courseId} studentId={currentStudent?.id} />}
      {showTrajectoryModal && <TrajectoryModal onClose={() => setShowTrajectoryModal(false)} courseId={courseId} studentId={currentStudent?.id} />}
      {showRubricModal && (
        <RubricModal 
          rubric={activeAssignment?.rubric} 
          onClose={() => setShowRubricModal(false)} 
        />
      )}

      <main className={styles.main}>
        <div className={styles.leftColumn}>

          <SubmissionNavigation 
            assignments={assignments}
            currentAssignmentId={currentAssignmentId}
            setCurrentAssignmentId={setCurrentAssignmentId}
            setCurrentIndex={setCurrentIndex}
            setGeneratedFeedbackId={setGeneratedFeedbackId}
            students={students}
            currentIndex={currentIndex}
          />

          <OptimizeLoadPost
            submission={submission}
            quizDetails={quizDetails}
            studentName={currentStudent.name}
            assignmentName={activeAssignment.name}
            isFetchingSubmission={isFetchingSubmission}
          />
        </div>

        <div className={styles.rightColumn}>
          <GradeConfigInfo 
            grade={grade}
            maxPoints={maxPoints}
            isFetchingSubmission={isFetchingSubmission}
            gradeRange={gradeRange}
            templateName={templateName}
            isManualMode={isManualMode}
            toggleManualMode={() => setIsManualMode(!isManualMode)}
          />

          {!isManualMode ? (
            <>
              {/* Botones de acción: Rúbrica, Ver Historial, Simular Trayectoria */}
              <SpeedGraderRubric 
                onShowHistory={() => setShowHistory(true)} 
                onShowTrajectory={() => setShowTrajectoryModal(true)}
                grade={scaledGrade} 
                hasRubric={!!activeAssignment?.rubric}
                onShowRubric={() => setShowRubricModal(true)}
                courseId={courseId}
                studentId={currentStudent?.id}
              />

              <AIControls
                feedback={feedback}
                loading={loading}
                generatedFeedbackId={generatedFeedbackId}
                rating={rating}
                setRating={setRating}
                handleGenerateMassive={handleGenerateMassive}
                handleApprove={handleApprove}
                isFeedbackApproved={isFeedbackApproved}
              />
            </>
          ) : (
            <ManualFeedbackPanel 
              onSubmit={handleManualSubmit}
              loading={loading}
            />
          )}
        </div>
      </main>

      </div>
    </ErrorBoundary>
  );
}