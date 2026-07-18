import { useCallback } from 'react';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './AssignmentList.module.css';

export default function AssignmentList({ assignments, onSelect }) {
  const logSelect = useButtonLogger();

  const handleSelect = useCallback(
    (a) => {
      logSelect('STUDENT_FEEDBACK_SELECT_ASSIGNMENT', () => onSelect?.(a))();
    },
    [onSelect, logSelect]
  );

  return (
    <div className={styles.container}>
      <h2 className={styles.courseTitle}>ISWII - Sección 1: Ingeniería de Software II</h2>
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
              <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16 }}>
                {a.score} <span style={{ fontSize: 12, color: '#666', fontWeight: 'normal' }}>/ {a.total}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                {a.hasFeedback && (
                  <Button variant="secondary" size="sm" onClick={() => handleSelect(a)}>
                    <span>💬</span> Ver Entrega y Feedback
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
