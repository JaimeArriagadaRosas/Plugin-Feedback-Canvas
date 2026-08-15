import React from 'react';
import styles from '../../../views/speedgrader/SubmissionViewer.module.css'; // We reuse styles

export default function UnsubmittedViewer({ studentName }) {
  return (
    <div className={styles.scrollableWrapper}>
      <div className={styles.fallbackCard}>
        <div className={styles.fallbackHeader} style={{ background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)' }}>
          <span className={styles.fallbackIcon}>📝</span>
          <h3 className={styles.fallbackTitle}>No Submission</h3>
        </div>
        <div className={styles.fallbackBody}>
          <p className={styles.fallbackMessage}>
            The student <strong>{studentName}</strong> has not submitted this assignment yet.
          </p>
        </div>
      </div>
    </div>
  );
}
