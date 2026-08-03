import React from 'react';
import styles from '../../../views/speedgrader/SubmissionViewer.module.css';

export default function FallbackEmptyViewer({ textBody }) {
  return (
    <div className={styles.scrollableWrapper}>
      <div className={styles.paper}>
        <p className={styles.text}>{textBody}</p>
      </div>
    </div>
  );
}
