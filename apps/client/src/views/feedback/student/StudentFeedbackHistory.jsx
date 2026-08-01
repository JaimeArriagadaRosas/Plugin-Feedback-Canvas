import { useCallback } from 'react';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './StudentFeedbackHistory.module.css';
import { GradeBadge } from '../../components/GradeBadges';

export default function StudentFeedbackHistory({ assignments, onSelect, courseName }) {
  const logSelect = useButtonLogger();

  const handleSelect = useCallback(
    (a) => {
      logSelect('STUDENT_FEEDBACK_SELECT_ASSIGNMENT', () => onSelect?.(a))();
    },
    [onSelect, logSelect]
  );

  return (
    <div className={styles.container}>
      <h2 className={styles.courseTitle}>{courseName || 'Historial de Feedback'}</h2>
      {assignments.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📚</div>
          <h3 className={styles.emptyTitle}>Sin feedback disponible</h3>
          <p className={styles.emptyText}>No tienes calificaciones ni feedback disponibles para este curso en este momento.</p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Fecha de entrega</th>
                <th style={{ textAlign: 'center' }}>Puntaje</th>
                <th style={{ textAlign: 'center' }}>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className={styles.assignmentName}>{a.name}</div>
                  </td>
                  <td>{a.due}</td>
                  <td style={{ textAlign: 'center' }}>
                    <GradeBadge grade={a.score} /> <span style={{ fontSize: 12, color: '#666', fontWeight: 'normal' }}>/ {a.total}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {a.hasFeedback && (
                      <Button variant="secondary" size="sm" onClick={() => handleSelect(a)}>
                        <span>💬</span> Feedback
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
