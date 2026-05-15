import { useState } from "react";
import StatusFooter from "../cursos/StatusFooter";

const styles = {
  wrapper: {
    fontFamily: "'Lato', sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#fff",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "20px 30px",
    borderBottom: "2px solid #2d3b45",
    background: "#f9f9f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  main: {
    flex: 1,
    padding: "30px",
  },
  gradesTable: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "20px",
    background: "#fff",
  },
  th: {
    textAlign: "left",
    padding: "12px 15px",
    borderBottom: "2px solid #c7cdd1",
    fontSize: "12px",
    color: "#666",
    textTransform: "uppercase",
  },
  td: {
    padding: "15px",
    borderBottom: "1px solid #c7cdd1",
  },
  scoreCell: {
    textAlign: "center",
    fontWeight: "bold",
    fontSize: "16px",
  },
  feedbackBtn: {
    background: "none",
    border: "1px solid #0770a3",
    color: "#0770a3",
    padding: "4px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "flex-end",
    zIndex: 3000,
  },
  panel: {
    width: "450px",
    background: "#fff",
    height: "100%",
    boxShadow: "-5px 0 15px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    animation: "slideIn 0.3s ease-out",
  },
  panelHeader: {
    padding: "20px",
    background: "#2d3b45",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bubble: {
    background: "#f0f4f7",
    border: "1px solid #c7cdd1",
    borderRadius: "8px",
    padding: "25px",
    margin: "20px",
    position: "relative",
  },
  studentHeader: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    marginBottom: "20px",
    borderBottom: "1px solid #c7cdd1",
    paddingBottom: "15px",
  },
  avatar: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    background: "#eee",
    border: "1px solid #ccc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  feedbackText: {
    fontSize: 15,
    lineHeight: "1.7",
    color: "#333",
    background: "#fff",
    padding: "20px",
    borderRadius: "4px",
    border: "1px solid #ddd",
    minHeight: "150px",
  }
};

export default function StudentFeedbackView({ onExit }) {
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  const assignments = [
    { id: 1, name: "Control 1: Diagramas de Clase", due: "05/05/2026", score: "6.0", total: "7.0", hasFeedback: true },
    { id: 2, name: "Taller 2: Casos de Uso", due: "12/05/2026", score: "5.5", total: "7.0", hasFeedback: false },
    { id: 3, name: "Examen Parcial", due: "20/05/2026", score: "-", total: "7.0", hasFeedback: false },
  ];

  return (
    <div style={styles.wrapper}>
      <style>
        {`
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}
      </style>
      
      <header style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>CALIFICACIONES</h1>
        <button 
          style={{ background: "#2d3b45", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "4px", cursor: "pointer" }}
          onClick={onExit}
        >
          Cerrar Vista Estudiante
        </button>
      </header>

      <main style={styles.main}>
        <div style={{ marginBottom: "20px", fontSize: "18px", fontWeight: "700" }}>
          ISWII - Sección 1: Ingeniería de Software II
        </div>

        <table style={styles.gradesTable}>
          <thead>
            <tr>
              <th style={styles.th}>Nombre</th>
              <th style={styles.th}>Fecha de entrega</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Puntaje</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Detalles</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id}>
                <td style={styles.td}>
                  <div style={{ color: "#0770a3", fontWeight: "700" }}>{a.name}</div>
                </td>
                <td style={styles.td}>{a.due}</td>
                <td style={{ ...styles.td, ...styles.scoreCell }}>
                  {a.score} <span style={{ fontSize: "12px", color: "#666", fontWeight: "normal" }}>/ {a.total}</span>
                </td>
                <td style={{ ...styles.td, textAlign: "center" }}>
                  {a.hasFeedback && (
                    <button 
                      style={styles.feedbackBtn}
                      onClick={() => setSelectedFeedback(a)}
                    >
                      <span>💬</span> Ver Feedback UNIDA
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: "40px", padding: "20px", background: "#f9f9f9", borderRadius: "4px", border: "1px dashed #ccc", fontSize: "13px", color: "#666" }}>
          <strong>Nota del Mockup:</strong> Esta pantalla simula la vista de "Calificaciones" de un estudiante en Canvas. 
          El feedback adaptativo generado por el plugin aparece como un anexo directo a la tarea calificada.
        </div>
      </main>

      {/* Feedback Side Panel */}
      {selectedFeedback && (
        <div style={styles.overlay} onClick={() => setSelectedFeedback(null)}>
          <div style={styles.panel} onClick={e => e.stopPropagation()}>
            <div style={styles.panelHeader}>
              <div style={{ fontWeight: "700" }}>DETALLE DE FEEDBACK UNIDA</div>
              <button 
                style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer" }}
                onClick={() => setSelectedFeedback(null)}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: "20px", borderBottom: "1px solid #eee" }}>
              <div style={{ fontSize: "18px", fontWeight: "700" }}>{selectedFeedback.name}</div>
              <div style={{ fontSize: "14px", color: "#666" }}>Calificación: {selectedFeedback.score} / {selectedFeedback.total}</div>
            </div>

            <div style={styles.bubble}>
              <div style={styles.studentHeader}>
                <div style={styles.avatar}>👤</div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: "700" }}>Juan Pérez</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>Estudiante</div>
                </div>
              </div>

              <div style={styles.feedbackText}>
                Excelente trabajo, Juan Pérez. Tu calificación de 6.0 en este {selectedFeedback.name} muestra un progreso significativo respecto a tus entregas anteriores. ¡Estamos muy contentos con tu mejora, sigue así!
              </div>

              <div style={{ marginTop: "20px", fontSize: "11px", color: "#666", textAlign: "right", fontStyle: "italic" }}>
                Generado por IA y aprobado por Prof. Elena Ramírez el 06/05/2026.
              </div>
            </div>
            
            <div style={{ flex: 1 }} />
            <div style={{ padding: "20px", background: "#f5f5f5", fontSize: "12px", color: "#888", textAlign: "center" }}>
              Plugin de Feedback Adaptativo - UNIDA UNAB
            </div>
          </div>
        </div>
      )}

      <StatusFooter 
        lastSync="16:20:10" 
        count={1} 
        label="Simulación de Vista de Calificaciones activa" 
      />
    </div>
  );
}
