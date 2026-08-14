import React from 'react';
import styles from '../FeedbackDetailView.module.css';

export default function StudentInfoCard({ feedback }) {
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>STUDENT INFORMATION</div>
        <div className={styles.cardBody}>
          <div className={styles.studentInfo}>
            <div className={styles.avatar}>👤</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Name:</div>
              <div style={{ fontSize: 16 }}>{feedback?.student}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "15px" }}>
            <span>📋</span>
            <div>
              <strong>Grade Obtained:</strong>
              <div>{feedback?.grade}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "15px" }}>
            <span style={{ color: "green", fontSize: "24px" }}>⬆</span>
            <div>
              <strong>Trajectory:</strong>
              <div>{feedback?.trajectory}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>PREVIOUS GRADES HISTORY</div>
        <div className={styles.cardBody}>
          {feedback?.historial && feedback.historial.length > 0 ? (
            feedback.historial.map((h, i) => (
              <div key={i} className={styles.scoreItem}>
                <span>Assessment {i + 1}:</span> <strong>{h.grade || h.nota}</strong>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "#666" }}>
              Historical data not available or loading...
            </div>
          )}
        </div>
      </div>
    </>
  );
}
