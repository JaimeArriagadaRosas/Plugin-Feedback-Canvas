import React from 'react';
import styles from '../../../views/speedgrader/SubmissionViewer.module.css';

export default function UnsupportedFileViewer({ fileName, studentName, fileUrl }) {
  return (
    <div className={styles.scrollableWrapper}>
      <div className={styles.fallbackCard}>
        <div className={styles.fallbackHeader}>
          <span className={styles.fallbackIcon}>📦</span>
          <h3 className={styles.fallbackTitle}>Receipt Confirmed</h3>
        </div>
        <div className={styles.fallbackBody}>
          <p className={styles.fallbackMessage}>
            The assignment <strong>{fileName}</strong> submitted by <strong>{studentName}</strong> has been received successfully.
          </p>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className={styles.downloadBtn}>
              Download Assignment
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
