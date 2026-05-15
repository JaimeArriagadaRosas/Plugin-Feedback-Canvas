import { useState, useEffect } from "react";

const styles = {
  wrapper: {
    fontFamily: "'Lato', sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#f5f5f5",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "15px 30px",
    background: "#fff",
    borderBottom: "1px solid #c7cdd1",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textTransform: "uppercase",
    margin: 0,
  },
  main: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    position: "relative",
  },
  canvasDocViewer: {
    flex: 1,
    background: "#fff",
    borderRight: "1px solid #c7cdd1",
    display: "flex",
    flexDirection: "column",
  },
  canvasTopBar: {
    padding: "10px 20px",
    background: "#f9f9f9",
    borderBottom: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
  },
  docContent: {
    flex: 1,
    padding: "40px",
    overflow: "auto",
    background: "#e0e4e7",
    display: "flex",
    justifyContent: "center",
  },
  paper: {
    width: "600px",
    background: "#fff",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    padding: "50px",
    minHeight: "800px",
  },
  canvasGradingPanel: {
    width: "250px",
    background: "#fff",
    borderRight: "1px solid #c7cdd1",
    padding: "20px",
  },
  gradeBox: {
    border: "1px solid #c7cdd1",
    padding: "15px",
    borderRadius: "4px",
    marginBottom: "20px",
    background: "#f9f9f9",
  },
  inputGrade: {
    width: "60px",
    padding: "5px",
    fontSize: "18px",
    fontWeight: "bold",
    textAlign: "center",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
  },
  pluginPanel: {
    width: "350px",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-2px 0 10px rgba(0,0,0,0.05)",
  },
  pluginHeader: {
    padding: "12px 15px",
    background: "#f0f4f7",
    borderBottom: "1px solid #c7cdd1",
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
  },
  pluginBody: {
    flex: 1,
    padding: "15px",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  feedbackPreview: {
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    padding: "15px",
    fontSize: 13,
    lineHeight: "1.6",
    background: "#fff",
    minHeight: "150px",
    maxHeight: "300px",
    overflow: "auto",
    whiteSpace: "pre-wrap"
  },
  btnAction: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center",
  }
};

// MOCK DATA Fallback
const MOCK_STUDENTS = [
  { id: 1, name: "Juan Pérez", submission: "Análisis de requisitos para el sistema de biblioteca..." },
  { id: 2, name: "María García", submission: "Propuesta de arquitectura basada en microservicios..." },
  { id: 3, name: "Pedro López", submission: "Diagrama de clases detallado con 15 entidades..." },
  { id: 4, name: "Ana Torres", submission: "Evaluación de costos y factibilidad técnica..." }
];

export default function SpeedGraderPanel({ onExit }) {
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grade, setGrade] = useState(7.0);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [statusMsg, setStatusMsg] = useState("Listo para generar feedback.");

  const currentStudent = students[currentIndex];

  const handleNext = () => {
    if (currentIndex < students.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFeedback("");
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFeedback("");
    }
  };

  const generateFeedback = async () => {
    setLoading(true);
    setStatusMsg("Conectando con el motor de IA...");
    setFeedback("");
    
    try {
      // Llamada a nuestra API Real (Puerto 3000)
      const response = await fetch('http://localhost:3000/api/feedback/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-token' 
        },
        body: JSON.stringify({
          courseId: 14852,
          assignmentId: 101,
          studentId: currentStudent.id,
          templateId: 1,
          grade: grade
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.mensaje || `Error del servidor (${response.status})`);
      }

      const result = await response.json();
      
      if (result.exito && result.data) {
        setFeedback(result.data.content);
        setStatusMsg("Feedback generado exitosamente.");
      } else {
        throw new Error(result.mensaje || "La respuesta del servidor no tiene el formato esperado.");
      }
    } catch (error) {
      console.error("Error al generar feedback:", error);
      setFeedback(`[ERROR] ${error.message}
      
Posibles causas:
1. El servidor (npm run server) no está ejecutándose en el puerto 3000.
2. Hay un error en la lógica de orquestación (revisa la consola de la terminal).
3. La API Key de Gemini no es válida o ha expirado.`);
      setStatusMsg("Error en la generación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>INTEGRACIÓN SPEEDGRADER - BASE DE DATOS AMPLIADA</h1>
        <button style={{ background: "#fff", border: "1px solid #c7cdd1", padding: "5px 15px", borderRadius: "4px", cursor: "pointer" }} onClick={onExit}>Volver al Panel</button>
      </header>

      <main style={styles.main}>
        <section style={styles.canvasDocViewer}>
          <div style={styles.canvasTopBar}>
            <div>
              <button onClick={handlePrev} disabled={currentIndex === 0} style={{ cursor: "pointer" }}>‹ Previo</button>
              <strong style={{ margin: "0 20px", fontSize: 16 }}>{currentStudent.name}</strong>
              <button onClick={handleNext} disabled={currentIndex === students.length - 1} style={{ cursor: "pointer" }}>Siguiente ›</button>
            </div>
            <div><strong>Estudiante {currentIndex + 1} de {students.length}</strong></div>
          </div>
          <div style={styles.docContent}>
            <div style={styles.paper}>
              <h2>Entrega: Control 1</h2>
              <p><strong>{currentStudent.name}</strong></p>
              <p style={{ marginTop: "30px", lineHeight: "1.8", border: "1px solid #eee", padding: "20px" }}>
                {currentStudent.submission}
              </p>
            </div>
          </div>
        </section>

        <section style={styles.canvasGradingPanel}>
          <div style={{ fontWeight: "bold", marginBottom: "15px", fontSize: 16 }}>Calificación</div>
          <div style={styles.gradeBox}>
            <input type="number" style={styles.inputGrade} value={grade} step="0.1" onChange={(e) => setGrade(parseFloat(e.target.value))} />
            <div style={{ fontSize: 12, marginTop: "10px", color: "#666" }}>Sincronizado con Canvas</div>
          </div>
        </section>

        <section style={styles.pluginPanel}>
          <div style={styles.pluginHeader}>GENERACIÓN DE FEEDBACK IA</div>
          <div style={styles.pluginBody}>
            <div style={{ fontSize: 12, background: "#fef9e7", padding: "10px", border: "1px solid #f9e79f" }}>
              <strong>Contexto Académico:</strong> La IA analizará la nota actual (${grade}), el historial de notas previas y el texto de la entrega.
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={styles.feedbackPreview}>
                {loading ? "🤖 La IA está orquestando los datos académicos y generando feedback..." : (feedback || "Haz clic en 'Generar Feedback' para comenzar.")}
              </div>
            </div>

            <button style={{ ...styles.btnAction, opacity: loading ? 0.6 : 1 }} onClick={generateFeedback} disabled={loading}>
              {loading ? "GENERANDO..." : "GENERAR FEEDBACK"}
            </button>
          </div>
        </section>
      </main>

      <footer style={{ background: "#eee", padding: "5px 30px", fontSize: 11, color: "#666" }}>
        STATUS: {statusMsg} | API: http://localhost:3000/api/feedback/generate
      </footer>
    </div>
  );
}
