import React from 'react';
import styles from '../../../views/speedgrader/SubmissionViewer.module.css'; // Reutilizamos estilos

export default function UnsubmittedViewer({ studentName }) {
  return (
    <div className={styles.scrollableWrapper}>
      <div className={styles.fallbackCard}>
        <div className={styles.fallbackHeader} style={{ background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)' }}>
          <span className={styles.fallbackIcon}>📝</span>
          <h3 className={styles.fallbackTitle}>Sin Entrega</h3>
        </div>
        <div className={styles.fallbackBody}>
          <p className={styles.fallbackMessage}>
            El estudiante <strong>{studentName}</strong> aún no ha entregado esta tarea.
          </p>
        </div>
      </div>
    </div>
  );
}
