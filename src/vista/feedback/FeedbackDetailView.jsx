import { useState } from "react";

const styles = {
  wrapper: {
    fontFamily: "'Lato', sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#f5f5f5",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "20px 30px",
    background: "#fff",
    borderBottom: "1px solid #c7cdd1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    textTransform: "uppercase",
    margin: 0,
  },
  main: {
    flex: 1,
    padding: "30px",
    display: "flex",
    gap: "25px",
    overflow: "auto",
  },
  leftCol: {
    flex: "0 0 350px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  centerCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  rightCol: {
    flex: "0 0 300px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  card: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "10px 15px",
    background: "#f0f4f7",
    borderBottom: "1px solid #c7cdd1",
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
  },
  cardBody: {
    padding: "15px",
  },
  studentInfo: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    marginBottom: "15px",
  },
  avatar: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "#eee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "30px",
    border: "1px solid #ccc",
  },
  scoreItem: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "5px",
    fontSize: 13,
  },
  chart: {
    height: "100px",
    borderLeft: "2px solid #ccc",
    borderBottom: "2px solid #ccc",
    marginTop: "20px",
    position: "relative",
    padding: "10px",
  },
  line: {
    position: "absolute",
    background: "#0770a3",
    height: "2px",
    width: "80%",
    top: "40%",
    left: "10%",
    transform: "rotate(-10deg)",
  },
  toolbar: {
    display: "flex",
    gap: "5px",
    padding: "8px",
    background: "#f9f9f9",
    borderBottom: "1px solid #eee",
  },
  toolBtn: {
    background: "none",
    border: "1px solid transparent",
    padding: "5px 8px",
    cursor: "pointer",
    fontSize: 16,
  },
  editor: {
    width: "100%",
    flex: 1,
    padding: "20px",
    fontSize: 15,
    border: "none",
    outline: "none",
    fontFamily: "inherit",
    resize: "none",
    boxSizing: "border-box",
  },
  btnPrimary: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "12px",
    borderRadius: "4px",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnSecondary: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "12px",
    borderRadius: "4px",
    fontWeight: 700,
    cursor: "pointer",
  },
  btnTertiary: {
    background: "#eee",
    border: "1px solid #c7cdd1",
    padding: "12px",
    borderRadius: "4px",
    fontWeight: 700,
    cursor: "pointer",
  }
};

export default function FeedbackDetailView({ feedback, onBack }) {
  const [text, setText] = useState(feedback?.feedback || "");

  const handleApprove = async () => {
    try {
      const response = await fetch('/api/feedback/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dev-token' },
        body: JSON.stringify({
          feedbackId: feedback.id,
          courseId: feedback.courseId,
          assignmentId: feedback.assignmentId,
          studentId: feedback.studentId,
          content: text
        })
      });
      const result = await response.json();
      if (result.exito) {
        alert("Feedback aprobado y enviado a Canvas.");
        onBack();
      } else {
        alert("Error: " + result.mensaje);
      }
    } catch (e) {
      console.error(e);
      alert("Error al intentar aprobar el feedback.");
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/feedback/${feedback.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dev-token' },
        body: JSON.stringify({ nuevoContenido: text })
      });
      const result = await response.json();
      if (result.exito) {
        alert("Edición guardada exitosamente.");
      }
    } catch (e) {
      console.error(e);
      alert("Error al guardar edición.");
    }
  };

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>VISTA DETALLADA DEL FEEDBACK</h1>
      </header>

      <main style={styles.main}>
        {/* Left Column */}
        <section style={styles.leftCol}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>INFORMACIÓN DEL ESTUDIANTE</div>
            <div style={styles.cardBody}>
              <div style={styles.studentInfo}>
                <div style={styles.avatar}>👤</div>
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

          <div style={styles.card}>
            <div style={styles.cardHeader}>HISTORIAL DE CALIFICACIONES PREVIAS: ISWII</div>
            <div style={styles.cardBody}>
              <div style={styles.scoreItem}><span>Control 1:</span> <strong>5.5</strong></div>
              <div style={styles.scoreItem}><span>Control 2:</span> <strong>7.0</strong></div>
              <div style={styles.scoreItem}><span>Taller 1:</span> <strong>4.8</strong></div>
              <div style={{ ...styles.scoreItem, borderTop: "1px solid #eee", paddingTop: "5px", marginTop: "5px" }}>
                <span>Promedio Parcial:</span> <strong>5.8</strong>
              </div>
              <div style={styles.chart}>
                <div style={styles.line}></div>
                <div style={{ position: "absolute", bottom: "-15px", left: "0", fontSize: "10px" }}>Trayectoria Histórica</div>
              </div>
            </div>
          </div>
        </section>

        {/* Center Column */}
        <section style={styles.centerCol}>
          <div style={{ ...styles.card, flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={styles.cardHeader}>TEXTO GENERADO PARA EDICIÓN</div>
            <div style={{ padding: "10px 15px", borderBottom: "1px solid #eee", fontSize: 13, background: "#f9f9f9" }}>
              Previsualización y Edición de Feedback
            </div>
            <div style={styles.toolbar}>
              <button style={styles.toolBtn}><b>B</b></button>
              <button style={styles.toolBtn}><i>I</i></button>
              <button style={styles.toolBtn}><u>U</u></button>
              <div style={{ width: "1px", background: "#ddd", margin: "0 5px" }} />
              <button style={styles.toolBtn}>•≡</button>
              <button style={styles.toolBtn}>1≡</button>
              <button style={styles.toolBtn}>≡</button>
              <div style={{ width: "1px", background: "#ddd", margin: "0 5px" }} />
              <button style={styles.toolBtn}>↩</button>
              <button style={styles.toolBtn}>↪</button>
            </div>
            <textarea
              style={styles.editor}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </section>

        {/* Right Column */}
        <section style={styles.rightCol}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>CONTROLES DE ACCIÓN</div>
            <div style={styles.cardBody}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: "15px" }}>
                <strong>Estado:</strong> Feedback visualizado para revisión.<br />
                Personalización Aplicada.<br />
                <strong>Última Sinc. Local:</strong> 11:30:05
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button style={styles.btnPrimary} onClick={handleApprove}>APROBAR Y PUBLICAR EN SPEEDGRADER</button>
                <button style={styles.btnSecondary} onClick={handleSave}>GUARDAR EDICIÓN (SIN ENVIAR)</button>
                <button style={styles.btnTertiary} onClick={onBack}>VOLVER A LISTA</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: "#eee", padding: "10px 30px", fontSize: 12, borderTop: "1px solid #ddd" }}>
        Visualizando feedback de {feedback?.student} (ID: JP123). Datos sincronizados de la base de datos local y Canvas API.
      </footer>
    </div>
  );
}
