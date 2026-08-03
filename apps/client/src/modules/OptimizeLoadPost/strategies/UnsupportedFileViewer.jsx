import React from 'react';
import styles from '../../../views/speedgrader/SubmissionViewer.module.css';

export default function UnsupportedFileViewer({ fileName, studentName, fileUrl }) {
  return (
    <div className={styles.scrollableWrapper}>
      <div className={styles.fallbackCard}>
        <div className={styles.fallbackHeader}>
          <span className={styles.fallbackIcon}>📦</span>
          <h3 className={styles.fallbackTitle}>Recepción Confirmada</h3>
        </div>
        <div className={styles.fallbackBody}>
          <p className={styles.fallbackMessage}>
            La tarea <strong>{fileName}</strong> entregada por <strong>{studentName}</strong> se ha recibido correctamente.
          </p>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className={styles.downloadBtn}>
              Descargar Tarea
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
