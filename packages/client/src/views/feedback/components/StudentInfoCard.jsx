import React from 'react';
import styles from '../FeedbackDetailView.module.css';

export default function StudentInfoCard({ feedback }) {
  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>INFORMACIÓN DEL ESTUDIANTE</div>
        <div className={styles.cardBody}>
          <div className={styles.studentInfo}>
            <div className={styles.avatar}>👤</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Nombre:</div>
              <div style={{ fontSize: 16 }}>{feedback?.student}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "15px" }}>
            <span>📋</span>
            <div>
              <strong>Calificación Obtenida:</strong>
              <div>{feedback?.grade}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "15px" }}>
            <span style={{ color: "green", fontSize: "24px" }}>⬆</span>
            <div>
              <strong>Trayectoria:</strong>
              <div>{feedback?.trajectory}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>HISTORIAL DE CALIFICACIONES PREVIAS</div>
        <div className={styles.cardBody}>
          {feedback?.historial && feedback.historial.length > 0 ? (
            feedback.historial.map((h, i) => (
              <div key={i} className={styles.scoreItem}>
                <span>Evaluación {i + 1}:</span> <strong>{h.grade || h.nota}</strong>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "#666" }}>
              Datos históricos no disponibles o cargando...
            </div>
          )}
        </div>
      </div>
    </>
  );
}
