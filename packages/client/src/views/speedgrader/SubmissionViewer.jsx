import styles from './SubmissionViewer.module.css';

export default function SubmissionViewer({
  submissionText,
  studentName,
  assignmentName,
  className = '',
}) {
  return (
    <section className={`${styles.viewer} ${className}`}>
      <div className={styles.meta}>
        <div>
          Entregado el: <strong>14 de mayo de 2026, 10:00 AM</strong>
        </div>
        <div>
          Intento: <strong>1 de 1</strong>
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.paper}>
          <hr className={styles.divider} />
          <p className={styles.text}>{submissionText}</p>
        </div>
      </div>
    </section>
  );
}
