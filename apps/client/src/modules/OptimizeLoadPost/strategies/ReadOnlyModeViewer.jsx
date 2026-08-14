import React from 'react';
import styles from '../../../views/speedgrader/SubmissionViewer.module.css'; // Reutilizamos estilos

export default function ReadOnlyModeViewer({ studentName }) {
  return (
    <div className={styles.scrollableWrapper}>
      <div className={styles.fallbackCard}>
        <div className={styles.fallbackHeader} style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' }}>
          <span className={styles.fallbackIcon}>⚠️</span>
          <h3 className={styles.fallbackTitle}>Servicio de IA Inactivo</h3>
        </div>
        <div className={styles.fallbackBody}>
          <p className={styles.fallbackMessage}>
            El <strong>modo de solo lectura</strong> está activado. No se han cargado los datos de esta entrega de <strong>{studentName}</strong> para evitar consumo innecesario de red.
          </p>
        </div>
      </div>
    </div>
  );
}
