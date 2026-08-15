import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStudentFeedback } from './hooks/useStudentFeedback';
import Button from '../../components/atoms/Button';
import StudentFeedbackHistory from './student/StudentFeedbackHistory';
import StudentRecentFeedback from './student/StudentRecentFeedback';
import NotificationPreferencesForm from '../../modules/preferences/components/NotificationPreferencesForm';
import RequirePermission from '../../components/atoms/RequirePermission';
import styles from './StudentFeedbackView.module.css';

export default function StudentFeedbackView({ initialStudentId = 1, onExit }) {
  const { courseId, courseName, user, studentId: contextStudentId } = useAuth();
  
  // If explicit Canvas studentId exists, we use it. If not, fallback to user (UUID) or the initial one.
  const studentId = contextStudentId || (user && user !== 'system' ? user : initialStudentId);

  const [showPreferences, setShowPreferences] = useState(false);

  const {
    assignments,
    loading,
    viewMode,
    selectedFeedback,
    studentRating,
    studentEsUtil,
    ratingSaved,
    handleSelectAssignment,
    handleRateFeedback,
    handleBackToList,
  } = useStudentFeedback(studentId, courseId);

  return (
    <RequirePermission 
      permission="view_feedback" 
      fallback={<div className={styles.wrapper} style={{ padding: '2rem', textAlign: 'center' }}><h2>Functionality disabled by the administrator.</h2></div>}
    >
      <div className={styles.wrapper}>
        <header className={styles.header}>
        <h1 className={styles.title}>
          {viewMode === 'list' ? 'GRADES' : 'SUBMISSION DETAILS'}
        </h1>
        <div className={styles.actions}>
          {viewMode === 'details' && (
            <Button variant="secondary" onClick={handleBackToList}>
              Back to Grades
            </Button>
          )}
          {viewMode === 'list' && (
            <>
              <button 
                className={styles.bellButton} 
                onClick={() => setShowPreferences(!showPreferences)}
                title="Notification preferences"
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
            studentEsUtil={studentEsUtil}
            ratingSaved={ratingSaved}
            onRate={handleRateFeedback}
            onBack={handleBackToList}
          />
        )}
      </main>
    </div>
    </RequirePermission>
  );
}
