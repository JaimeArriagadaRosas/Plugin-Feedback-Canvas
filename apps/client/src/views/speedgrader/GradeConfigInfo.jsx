import React from 'react';
import styles from './SpeedGraderPanel.module.css';

export default function GradeConfigInfo({
  grade,
  maxPoints,
  isFetchingSubmission,
  gradeRange,
  templateName,
  isManualMode,
  toggleManualMode
}) {
  return (
    <>
      <section className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
          <h3 className={styles.sectionTitle} style={{ borderBottom: 'none', paddingBottom: 0, margin: 0 }}>Calificación y comentarios</h3>
          <button 
            onClick={toggleManualMode} 
            className={styles.manualToggleButton} 
            title={isManualMode ? 'Volver a Feedback IA' : 'Modo Feedback Manual'}
            style={{ padding: '2px 6px', fontSize: '14px', border: 'none', background: 'transparent' }}
          >
            {isManualMode ? '🤖' : '✍️'}
          </button>
        </div>
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

      {!isManualMode && (
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
      )}
    </>
  );
}
