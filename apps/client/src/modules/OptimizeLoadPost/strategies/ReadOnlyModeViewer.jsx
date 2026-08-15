import React from 'react';
import styles from '../../../views/speedgrader/SubmissionViewer.module.css'; // We reuse styles

export default function ReadOnlyModeViewer({ studentName }) {
  return (
    <div className={styles.scrollableWrapper}>
      <div className={styles.fallbackCard}>
        <div className={styles.fallbackHeader} style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' }}>
          <span className={styles.fallbackIcon}>⚠️</span>
          <h3 className={styles.fallbackTitle}>AI Service Inactive</h3>
        </div>
        <div className={styles.fallbackBody}>
          <p className={styles.fallbackMessage}>
            The <strong>read-only mode</strong> is enabled. Data for this submission by <strong>{studentName}</strong> has not been loaded to avoid unnecessary network usage.
          </p>
        </div>
      </div>
    </div>
  );
}
