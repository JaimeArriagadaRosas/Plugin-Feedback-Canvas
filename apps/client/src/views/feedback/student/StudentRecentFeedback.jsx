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
  ratingSaved,
  onRate,
  onBack,
}) {
  const logRate = useButtonLogger();
  const logBack = useButtonLogger();

  const handleRate = useCallback(
    async (rating) => {
      await logRate(`STUDENT_FEEDBACK_RATE_${rating}`, () => onRate?.(assignment.feedback.id, rating))();
    },
    [assignment, onRate, logRate]
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
                  <Avatar name={assignment.feedback.teacherName || "Profesor del Curso"} size="md" />
                  <div className={styles.teacherInfo}>
                    <div className={styles.teacherName}>{assignment.feedback.teacherName || "Profesor del Curso"}</div>
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
                <h3 className={styles.ratingTitle}>¿Qué tan útil te resultó este feedback?</h3>
                <div className={styles.ratingControls}>
                  <StarRating 
                    value={studentRating} 
                    onChange={handleRate} 
                    readonly={false} 
                  />
                  {ratingSaved && <span className={styles.ratingSavedMsg}>✓ ¡Gracias por tu valoración!</span>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.noFeedback}>
            No hay comentarios disponibles para esta tarea.
          </div>
        )}
      </div>
    </div>
  );
}
