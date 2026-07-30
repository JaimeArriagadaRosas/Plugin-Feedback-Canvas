import { useCallback } from 'react';
import Avatar from '../../../components/atoms/Avatar';
import StudentUtilityRating from './StudentUtilityRating';
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
    <div className={styles.splitView}>
      <section className={styles.viewer}>
        <div className={styles.meta}>
          <span>Entregado el: <strong>14 de mayo de 2026, 10:00 AM</strong></span>
          <span>Intento: <strong>1 de 1</strong></span>
        </div>
        <div className={styles.paper}>
          <h2 className={styles.title}>Entrega: {assignment.name}</h2>
          <p className={styles.student}>Estudiante: <strong>{studentId}</strong></p>
          <hr className={styles.divider} />
          <p className={styles.text}>
            (El documento del estudiante aparece aquí en el visor de Canvas...)<br /><br />
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
          </p>
        </div>
      </section>

      <section className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarTitle}>Detalles de la Entrega</div>
          <div className={styles.sidebarScore}>
            Calificación: <strong>{assignment.score} / {assignment.total}</strong>
          </div>
        </div>

        <div className={styles.commentsHeader}>Comentarios de la Tarea</div>

        {assignment.feedback && (
          <div className={styles.bubble}>
            <div className={styles.studentHeader}>
              <Avatar name="Profesor del Curso" size="sm" />
              <div>
                <div className={styles.teacherName}>Profesor del Curso</div>
                <div className={styles.teacherDate}>
                  {new Date(assignment.feedback.fecha_generacion).toLocaleString()}
                </div>
              </div>
            </div>

            <div className={styles.feedbackText}>
              {assignment.feedback.contenido_generado}
            </div>

            <StudentUtilityRating 
              rating={studentRating} 
              onRate={handleRate} 
              readonly={ratingSaved} 
            />
          </div>
        )}

        <div className={styles.sidebarActions}>
          <Button variant="secondary" onClick={handleBack}>
            Volver a Calificaciones
          </Button>
        </div>
      </section>
    </div>
  );
}
