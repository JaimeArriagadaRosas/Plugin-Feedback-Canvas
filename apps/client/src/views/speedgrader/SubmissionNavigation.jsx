import React from 'react';
import styles from './SpeedGraderPanel.module.css';

export default function SubmissionNavigation({
  assignments,
  currentAssignmentId,
  setCurrentAssignmentId,
  setCurrentIndex,
  setGeneratedFeedbackId,
  students,
  currentIndex,
}) {
  return (
    <div className={styles.submissionHeader}>
      <div className={styles.submissionHeaderLeft}>
        <p className={styles.submissionStudent}>
          Tarea:{' '}
          <select 
            className={styles.studentSelectLeft}
            value={currentAssignmentId || ''}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setCurrentAssignmentId(newId);
              setCurrentIndex(0);
              setGeneratedFeedbackId(null);
            }}
            style={{ minWidth: '200px' }}
          >
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {assignments.length === 0 && (
              <option value="">Sin Tarea</option>
            )}
          </select>
        </p>
      </div>
      <div className={styles.submissionHeaderRight}>
        <button
          className={styles.navButton}
          onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
          disabled={currentIndex === 0}
        >
          ‹ Anterior
        </button>
        <select 
          className={styles.studentSelectCenter}
          value={currentIndex}
          onChange={(e) => setCurrentIndex(Number(e.target.value))}
        >
          {students.map((student, idx) => (
            <option key={student.id} value={idx}>
              {student.name}
            </option>
          ))}
          {students.length === 0 && (
            <option value={0}>Sin Estudiante</option>
          )}
        </select>
        <button
          className={styles.navButton}
          onClick={() => currentIndex < students.length - 1 && setCurrentIndex(currentIndex + 1)}
          disabled={currentIndex === students.length - 1}
        >
          Siguiente ›
        </button>
      </div>
    </div>
  );
}
