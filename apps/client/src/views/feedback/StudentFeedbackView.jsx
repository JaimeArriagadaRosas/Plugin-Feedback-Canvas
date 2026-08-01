import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStudentFeedback } from './hooks/useStudentFeedback';
import Button from '../../components/atoms/Button';
import StudentFeedbackHistory from './student/StudentFeedbackHistory';
import StudentRecentFeedback from './student/StudentRecentFeedback';
import NotificationPreferencesForm from '../../modules/preferences/components/NotificationPreferencesForm';
import styles from './StudentFeedbackView.module.css';

export default function StudentFeedbackView({ initialStudentId = 1, onExit }) {
  const { courseId, courseName, user, studentId: contextStudentId } = useAuth();
  
  // Si studentId explícito de Canvas existe, lo usamos. Si no, fallback al user (UUID) o al inicial.
  const studentId = contextStudentId || (user && user !== 'system' ? user : initialStudentId);

  const [showPreferences, setShowPreferences] = useState(false);

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
  } = useStudentFeedback(studentId, courseId);

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
          {viewMode === 'list' && (
            <>
              <button 
                className={styles.bellButton} 
                onClick={() => setShowPreferences(!showPreferences)}
                title="Preferencias de notificación"
              >
                🔔
              </button>
              
              {showPreferences && (
                <div className={styles.preferencesPopover}>
                  <NotificationPreferencesForm onClose={() => setShowPreferences(false)} />
                </div>
              )}
            </>
          )}
        </div>
      </header>

      <main className={styles.main}>
        {viewMode === 'list' ? (
          <StudentFeedbackHistory assignments={assignments} onSelect={handleSelectAssignment} courseName={courseName} />
        ) : (
          <StudentRecentFeedback
            assignment={selectedFeedback}
            studentId={studentId}
            studentRating={studentRating}
            ratingSaved={ratingSaved}
            onRate={handleRateFeedback}
            onBack={handleBackToList}
          />
        )}
      </main>
    </div>
  );
}
