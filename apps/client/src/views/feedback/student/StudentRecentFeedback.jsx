import { useCallback } from 'react';
import React from 'react';
import Avatar from '../../../components/atoms/Avatar';
import StarRating from '../../../components/molecules/StarRating';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './StudentRecentFeedback.module.css';

export default function StudentRecentFeedback({
  assignment,
  studentId,
  studentRating,
  studentEsUtil,
  ratingSaved,
  onRate,
  onBack,
}) {
  const logRate = useButtonLogger();
  const logBack = useButtonLogger();

  const handleRate = useCallback(
    async (rating) => {
      await logRate(`STUDENT_FEEDBACK_RATE_${rating}`, () => onRate?.(assignment.feedback.id, rating, studentEsUtil))();
    },
    [assignment, onRate, logRate, studentEsUtil]
  );

  const handleUtilChange = useCallback(
    async (esUtil) => {
      await logRate(`STUDENT_FEEDBACK_UTIL_${esUtil}`, () => onRate?.(assignment.feedback.id, studentRating, esUtil))();
    },
    [assignment, onRate, logRate, studentRating]
  );

  const handleBack = useCallback(
    async () => {
      await logBack('STUDENT_FEEDBACK_BACK', () => onBack?.())();
    },
    [onBack, logBack]
  );

  return (
    <div className={styles.container}>
      <div className={styles.unifiedCard}>
        <header className={styles.metaHeader}>
          <div className={styles.metaMain}>
            <h1 className={styles.assignmentTitle}>{assignment.name}</h1>
          </div>
          <div className={styles.scoreContainer}>
            <div className={styles.scoreCircle}>
              <span className={styles.scoreNumber}>{assignment.score}</span>
              <span className={styles.scoreTotal}>/ {assignment.total}</span>
            </div>
          </div>
        </header>

        {assignment.feedback ? (
          <div className={styles.feedbackBody}>
            <div className={styles.feedbackSplit}>
              <div className={styles.feedbackMain}>
                <div className={styles.teacherHeader}>
                  <Avatar name={assignment.feedback.teacherName || "Course Teacher"} size="md" />
                  <div className={styles.teacherInfo}>
                    <div className={styles.teacherName}>{assignment.feedback.teacherName || "Course Teacher"}</div>
                    <div className={styles.teacherDate}>
                      {new Date(assignment.feedback.fecha_generacion).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className={styles.feedbackContent}>
                  {assignment.feedback.contenido_generado}
                </div>
              </div>

              <div className={styles.ratingAreaSide}>
                <h3 className={styles.ratingTitle}>Rate the feedback</h3>
                <div className={styles.ratingControls} style={{ marginBottom: '1.5rem' }}>
                  <StarRating 
                    value={studentRating} 
                    onChange={handleRate} 
                    readonly={false} 
                  />
                </div>

                <h3 className={styles.ratingTitle}>Was this feedback useful?</h3>
                <div className={styles.utilControls} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
                  <Button 
                    variant={studentEsUtil === true ? 'primary' : 'outline'} 
                    onClick={() => handleUtilChange(true)}
                  >
                    Yes, it was useful
                  </Button>
                  <Button 
                    variant={studentEsUtil === false ? 'danger' : 'outline'} 
                    onClick={() => handleUtilChange(false)}
                  >
                    It wasn't useful
                  </Button>
                </div>

                {ratingSaved && <span className={styles.ratingSavedMsg}>✓ Thank you for your rating!</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.noFeedback}>
            No feedback available for this assignment.
          </div>
        )}
      </div>
    </div>
  );
}
