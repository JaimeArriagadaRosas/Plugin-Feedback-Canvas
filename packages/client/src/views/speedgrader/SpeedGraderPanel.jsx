import { useCallback, useState } from 'react';
import { api } from 'shared/api';
import Button from '../../components/atoms/Button';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useSpeedGraderData } from './hooks/useSpeedGraderData';
import StudentNavigator from './StudentNavigator';
import AssignmentSelector from './AssignmentSelector';
import GradeInput from './GradeInput';
import SubmissionViewer from './SubmissionViewer';
import FeedbackGenerator from './FeedbackGenerator';
import { useSpeedGraderActions } from './hooks/useSpeedGraderActions';
import styles from './SpeedGraderPanel.module.css';
import logger from '../../utils/logger';

export default function SpeedGraderPanel({ onExit }) {
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

  const { handleGenerate, handleApprove, handleManualSubmit, handleExit } = useSpeedGraderActions({
    courseId,
    currentAssignmentId,
    currentStudent,
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

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Button variant="ghost" size="sm" onClick={handleExit}>
            <span>📊</span> Libro de Calificaciones
          </Button>
          <div className={styles.divider} />
          <AssignmentSelector
            assignments={assignments}
            currentAssignmentId={currentAssignmentId}
            onChange={setCurrentAssignmentId}
          />
        </div>

        <div className={styles.headerRight}>
          <Button variant="ghost" size="sm" onClick={() => window.open('https://youtube.com/shorts/unida-tutorial', '_blank')}>
            <span>🎬</span> Tutoriales
          </Button>
          <div className={styles.divider} />
          <StudentNavigator
            students={students}
            currentIndex={currentIndex}
            onChange={setCurrentIndex}
            onExit={onExit}
          />
        </div>
      </header>

      <main className={styles.main}>
        <SubmissionViewer
          submissionText={submissionText}
          studentName={currentStudent.name}
          assignmentName={activeAssignment.name}
        />

        <section className={styles.gradingPanel}>
          <div className={styles.gradeTitle}>Calificación</div>
          <GradeInput grade={grade} maxPoints={activeAssignment.points} onChange={setGrade} />
        </section>

        <FeedbackGenerator
          loading={loading}
          feedback={feedback}
          setFeedback={setFeedback}
          generatedFeedbackId={generatedFeedbackId}
          onGenerate={handleGenerate}
          onApprove={handleApprove}
          onManualSubmit={handleManualSubmit}
          grade={grade}
          activeAssignment={activeAssignment}
        />
      </main>

      <footer className={styles.footer}>
        STATUS: {statusMsg} | API: /api/feedback/generate
      </footer>
    </div>
  );
}
