import React from 'react';
import styles from './TextEntryViewer.module.css';

export default function TextEntryViewer({ submission, studentName, assignmentName }) {
  const content = submission?.body || 'Sin contenido de entrega.';
  const score = submission?.score ?? 'N/A';
  
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3>Entrega de Texto de {studentName}</h3>
        <p className={styles.scoreInfo}>
          Puntaje: {score}
        </p>
      </div>

      <div className={styles.contentCard}>
        <div 
          className={styles.bodyText} 
          dangerouslySetInnerHTML={{ __html: content }} 
        />
      </div>
    </div>
  );
}
