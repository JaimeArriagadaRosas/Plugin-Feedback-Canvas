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
  main: {
    flex: 1,
    padding: "30px",
    display: "flex",
    gap: "30px",
  },
  sidebar: {
    flex: "0 0 350px",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    background: "#f0f4f7",
    overflow: "hidden",
  },
  sidebarHeader: {
    padding: "12px 15px",
    background: "#2d3b45",
    color: "#fff",
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
  },
  assignmentItem: {
    padding: "15px",
    borderBottom: "1px solid #c7cdd1",
    background: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  assignmentActive: {
    background: "#fff",
    borderLeft: "5px solid #0770a3",
    boxShadow: "inset 0 0 10px rgba(0,0,0,0.05)",
  },
  content: {
    flex: 1,
    position: "relative",
  },
  bubble: {
    background: "#f0f4f7",
    border: "1px solid #c7cdd1",
    borderRadius: "8px",
    padding: "25px",
    position: "relative",
    boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
  },
  bubbleArrow: {
    position: "absolute",
    left: "-15px",
    top: "40px",
    width: "0", height: "0",
    borderTop: "15px solid transparent",
    borderBottom: "15px solid transparent",
    borderRight: "15px solid #c7cdd1",
  },
  bubbleArrowInner: {
    position: "absolute",
    left: "2px",
    top: "-15px",
    width: "0", height: "0",
    borderTop: "15px solid transparent",
    borderBottom: "15px solid transparent",
    borderRight: "15px solid #f0f4f7",
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
  },
  btnRubric: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "5px 15px",
    borderRadius: "4px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: "15px",
  }
};

export default function StudentFeedbackView({ onExit }) {
  return (
    <div style={styles.wrapper}>
      <header style={{ padding: "20px 30px", borderBottom: "2px solid #2d3b45", background: "#f9f9f9" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, textTransform: "uppercase" }}>
            VISTA DE CALIFICACIONES DEL ESTUDIANTE (RF31)
          </h1>
          <button 
            style={{ background: "#2d3b45", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "4px", cursor: "pointer" }}
            onClick={onExit}
          >
            Cerrar Vista Estudiante
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Left List */}
        <section style={styles.sidebar}>
          <div style={styles.sidebarHeader}>RECIENTES RECIENTES</div>
          <div style={{ ...styles.assignmentItem }}>
            <span style={{ fontSize: 18 }}>⌵</span>
            <div>
              <div style={{ fontWeight: 700 }}>ISWII - Sección 1:</div>
              <div style={{ fontSize: 12 }}>Control 1: Diagramas de Clase</div>
            </div>
          </div>
          <div style={{ ...styles.assignmentItem, ...styles.assignmentActive }}>
            <span style={{ fontSize: 18, color: "#0770a3" }}>☑</span>
            <div>
              <div style={{ fontWeight: 700 }}>ISWII - Sección 1:</div>
              <div style={{ fontSize: 12 }}>Control 1: Diagramas de Clase</div>
            </div>
          </div>
          <div style={{ ...styles.assignmentItem }}>
            <span style={{ fontSize: 18 }}>❯</span>
            <div>
              <div style={{ fontWeight: 700 }}>ISWII - Sección 1:</div>
              <div style={{ fontSize: 12 }}>Control 1: Diagramas de Clase</div>
            </div>
          </div>
        </section>

        {/* Feedback Bubble */}
        <section style={styles.content}>
          <div style={{ fontWeight: 700, marginBottom: "15px", fontSize: 16 }}>Comentario de Rúbrica y Feedback (RF31)</div>
          <div style={styles.bubble}>
            <div style={styles.bubbleArrow}><div style={styles.bubbleArrowInner} /></div>
            
            <div style={styles.studentHeader}>
              <div style={styles.avatar}>👤</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Juan Pérez</div>
                <div style={{ fontSize: 12, color: "#666" }}>(from &lt;IMAGE5&gt;)</div>
              </div>
            </div>

            <button style={styles.btnRubric}>RÚBRICA COMPLETA</button>

            <div style={styles.feedbackText}>
              Excelente trabajo, Juan Pérez. Tu calificación de 6 en este Control 2 muestra un progreso significativo respecto a tus entregas anteriores (promedio previo: 5.9). ¡Estamos muy contentos con tu mejora, sigue así!
            </div>

            <div style={{ marginTop: "20px", fontSize: 12, color: "#666", textAlign: "right", fontStyle: "italic" }}>
              Recibido de Profr. Elena Ramírez (ID: ER45) el 06/05/2026 15:55:01.
            </div>
          </div>

          <div style={{ marginTop: "40px", fontSize: 12, color: "#666", padding: "20px", background: "#f9f9f9", borderRadius: "4px", border: "1px dashed #ccc" }}>
            <strong>RF31:</strong> El feedback se visualiza como un comentario de rúbrica en la entrega. Este es el resultado final de la cadena de valor: ESTUDIANTE (RF31) → MODIFICAR → MODIFICAR (RF25) → SPEEDGRADER (RF16) → SINCRONIZAR (RF26).
          </div>
        </section>
      </main>

      <StatusFooter 
        lastSync="12:00:10" 
        count={1} 
        label="Feedbacks visualizados exitosamente por Juan Pérez (ID: JP123)" 
      />
    </div>
  );
}
