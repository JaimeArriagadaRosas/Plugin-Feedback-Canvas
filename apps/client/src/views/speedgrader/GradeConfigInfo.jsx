import React from 'react';
import styles from './SpeedGraderPanel.module.css';

export default function GradeConfigInfo({
  grade,
  maxPoints,
  isFetchingSubmission,
  gradeRange,
  templateName
}) {
  return (
    <>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Calificación y comentarios</h3>
        <div className={styles.gradeDisplay}>
          <span className={styles.gradeValue}>
            {isFetchingSubmission ? '...' : (typeof grade === 'number' ? grade.toFixed(1) : grade)} pts
          </span>
          {maxPoints != null && (
            <>
              <span className={styles.gradeSeparator}>/</span>
              <span className={styles.gradeMax}>{maxPoints} pts</span>
            </>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Configuración detectada</h3>
        <div className={styles.configRow}>
          <span className={styles.configLabel}>Rango de nota:</span>
          <span className={styles.configValue}>{gradeRange}</span>
        </div>
        <div className={styles.configRow}>
          <span className={styles.configLabel}>Plantilla activada:</span>
          <span className={styles.configValue}>{templateName}</span>
        </div>
      </section>
    </>
  );
}
