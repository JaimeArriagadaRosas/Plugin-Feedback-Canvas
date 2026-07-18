import { useCallback } from 'react';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useStudentFeedback } from './hooks/useStudentFeedback';
import Button from '../../components/atoms/Button';
import AssignmentList from './student/AssignmentList';
import FeedbackDetails from './student/FeedbackDetails';
import StatusFooter from '../cursos/StatusFooter';
import styles from './StudentFeedbackView.module.css';

export default function StudentFeedbackView({ initialStudentId = 1, onExit }) {
  const { logClick } = useButtonLogger();
  const {
    assignments,
    loading,
    viewMode,
    selectedFeedback,
    studentRating,
    ratingSaved,
    handleSelectAssignment,
    handleRateFeedback,
    handleBackToList,
  } = useStudentFeedback(initialStudentId);

  const handleExit = useCallback(
    async () => {
      logClick('STUDENT_FEEDBACK_EXIT');
      onExit?.();
    },
    [onExit, logClick]
  );

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {viewMode === 'list' ? 'CALIFICACIONES' : 'DETALLES DE LA ENTREGA'}
        </h1>
        <div className={styles.actions}>
          {viewMode === 'details' && (
            <Button variant="secondary" onClick={handleBackToList}>
              Volver a Calificaciones
            </Button>
          )}
          <Button variant="secondary" onClick={handleExit}>
            Cerrar Vista Estudiante
          </Button>
        </div>
      </header>

      <main className={styles.main}>
        {viewMode === 'list' ? (
          <AssignmentList assignments={assignments} onSelect={handleSelectAssignment} />
        ) : (
          <FeedbackDetails
            assignment={selectedFeedback}
            studentId={initialStudentId}
            studentRating={studentRating}
            ratingSaved={ratingSaved}
            onRate={handleRateFeedback}
            onBack={handleBackToList}
          />
        )}
      </main>

      <StatusFooter
        lastSync="16:20:10"
        count={assignments.length}
        label="Vista de Calificaciones local activa"
      />
    </div>
  );
}
