import React from 'react';
import styles from './TextEntryViewer.module.css';

export default function TextEntryViewer({ submission, studentName, assignmentName }) {
  const content = submission?.body || 'No submission content.';
  const score = submission?.score ?? 'N/A';
  
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h3>Text Submission by {studentName}</h3>
        <p className={styles.scoreInfo}>
          Score: {score}
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
