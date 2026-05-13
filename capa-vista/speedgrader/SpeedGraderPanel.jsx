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
    fontSize: 20,
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
  infoBox: {
    border: "1px solid #f9e79f",
    borderRadius: "4px",
    padding: "12px",
    fontSize: 13,
    background: "#fef9e7",
  },
  logicBox: {
    border: "1px solid #f0b27a",
    background: "#fdf2e9",
    padding: "10px",
    borderRadius: "4px",
    fontSize: 12,
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
  },
  statusbar: {
    background: "#eee",
    borderTop: "1px solid #ddd",
    padding: "7px 30px",
    fontSize: 12,
    color: "#2d3b45",
    fontWeight: 600,
  },
  // RF02/RF05 History Popup
  historyPopup: {
    position: "absolute",
    left: "40%",
    top: "30%",
    width: "320px",
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "8px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    zIndex: 1500,
  },
  historyHeader: {
    background: "#f0f4f7",
    padding: "10px 15px",
    fontWeight: 700,
    fontSize: 12,
    borderBottom: "1px solid #c7cdd1",
  },
  historyBody: {
    padding: "15px",
  },
  chart: {
    display: "flex",
    alignItems: "flex-end",
    gap: "10px",
    height: "60px",
    marginTop: "10px",
    borderBottom: "2px solid #ccc",
  },
  bar: {
    background: "#0770a3",
    width: "20px",
  }
};

export default function SpeedGraderPanel({ onExit }) {
  const [grade, setGrade] = useState(7.0);
  const [prevAvg, setPrevAvg] = useState(5.8); // Default case: Improvement
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [rfMode, setRfMode] = useState("RF05");

  useEffect(() => {
    updateFeedback();
  }, [grade, prevAvg]);

  const updateFeedback = () => {
    setLoading(true);
    let isImprovement = grade >= prevAvg;
    let text = "";
    
    if (isImprovement) {
      text = `Excelente trabajo, Juan Pérez. Tu calificación de ${grade} en este Control 1 muestra un progreso significativo respecto a tus entregas anteriores (promedio previo: ${prevAvg}). ¡Estamos muy contentos con tu mejora, sigue así!`;
    } else {
      text = `Estimado Juan Pérez, tu calificación de ${grade} en este Control 1 es una nota sólida. Sin embargo, representa un retroceso respecto a tus excelentes calificaciones previas (promedio previo: ${prevAvg}). Te invitamos a revisar los temas clave para volver a tu nivel habitual. ¡Estamos para ayudarte!`;
    }

    setFeedback(text);
    setStatusMsg("RF05 Estado: Lógica de personalización por trayectoria (RF05) aplicada. Datos de historial de Canvas sincronizados. Última sinc.: 11:20:01.");
    setLoading(false);
  };

  const toggleTrajectory = () => {
    setPrevAvg(prevAvg === 5.8 ? 9.1 : 5.8);
  };

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <h1 style={styles.title}>SPEEDGRADER INTEGRATION - RF05 TRAJECTORY FEEDBACK</h1>
        <button 
          style={{ background: "#fff", border: "1px solid #c7cdd1", padding: "5px 15px", borderRadius: "4px", cursor: "pointer" }}
          onClick={onExit}
        >
          Volver al Panel
        </button>
      </header>

      <main style={styles.main}>
        {/* Canvas Doc Viewer */}
        <section style={styles.canvasDocViewer}>
          <div style={styles.canvasTopBar}>
            <div><span>‹ Previo</span> <strong style={{ margin: "0 20px", fontSize: 16 }}>Juan Pérez</strong> <span>Siguiente ›</span></div>
            <div><strong>Control 1: Diagramas de Clase</strong></div>
          </div>
          <div style={styles.docContent}>
            <div style={styles.paper}>
              <h2>Ensayo sobre Diagramas de Clase</h2>
              <p><strong>Juan Pérez</strong></p>
              <p style={{ marginTop: "30px", lineHeight: "1.8" }}>
                [Simulación del contenido del trabajo del estudiante...]
              </p>
            </div>
          </div>
        </section>

        {/* Canvas Grading Panel */}
        <section style={styles.canvasGradingPanel}>
          <div style={{ fontWeight: "bold", marginBottom: "15px", fontSize: 16 }}>Calificación y Comentarios</div>
          <div style={styles.gradeBox}>
            <div style={{ fontSize: 14, marginBottom: "8px" }}>Calificación (sobre 10)</div>
            <input 
              type="number" 
              style={styles.inputGrade} 
              value={grade} 
              step="0.1"
              onChange={(e) => setGrade(parseFloat(e.target.value))}
            />
            <button style={{ marginTop: "15px", width: "100%", padding: "5px", border: "1px solid #c7cdd1", background: "#fff", borderRadius: "3px", fontSize: 12 }}>
              ▦ Rúbrica
            </button>
          </div>
          
          <button 
            style={{ 
              width: "100%", 
              padding: "10px", 
              background: showHistory ? "#0770a3" : "#fff", 
              color: showHistory ? "#fff" : "#2d3b45",
              border: "1px solid #c7cdd1", 
              borderRadius: "4px", 
              cursor: "pointer",
              fontWeight: "bold",
              marginBottom: "10px"
            }}
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? "Ocultar Historial" : "Ver Historial"}
          </button>

          <button 
            style={{ 
              width: "100%", 
              padding: "8px", 
              background: "#fff", 
              border: "1px dashed #0770a3", 
              borderRadius: "4px", 
              cursor: "pointer",
              fontSize: 12
            }}
            onClick={toggleTrajectory}
          >
            Simular Trayectoria: {prevAvg === 5.8 ? "ALTA (Regresión)" : "BAJA (Mejora)"}
          </button>
        </section>

        {/* UNIDA Side Panel */}
        <section style={styles.pluginPanel}>
          <div style={styles.pluginHeader}>UNIDA FEEDBACK ADAPTATIVO (IA)</div>
          <div style={styles.pluginBody}>
            <div style={styles.infoBox}>
              <div style={{ fontWeight: "bold", marginBottom: "5px", color: "#b9770e", fontSize: 11, textTransform: "uppercase" }}>CONFIGURACIÓN DETECTADA</div>
              <div><strong>Rango Detectado:</strong> Logrado (6-10)</div>
              <div><strong>Plantilla Activada:</strong> Feedback Detallado ISWII</div>
            </div>

            <div style={styles.logicBox}>
              <div style={{ fontWeight: "bold", marginBottom: "5px", color: "#d35400", fontSize: 11, textTransform: "uppercase" }}>LÓGICA DE PERSONALIZACIÓN RF05</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div>PREVIO ({prevAvg})</div>
                <div>{grade >= prevAvg ? "<" : ">"}</div>
                <div style={{ fontWeight: "bold" }}>ACTUAL ({grade})</div>
              </div>
              <div style={{ marginTop: "5px", fontWeight: "bold", color: grade >= prevAvg ? "#27ae60" : "#c0392b" }}>
                Condición: Generar texto de {grade >= prevAvg ? "MEJORA" : "RETROCESO"}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ fontWeight: "bold", color: "#0770a3", fontSize: 11, textTransform: "uppercase" }}>FEEDBACK PARA TRAYECTORIA DE {grade >= prevAvg ? "MEJORA" : "RETROCESO"} (RF05)</div>
              <div style={styles.feedbackPreview}>
                {loading ? "Calculando trayectoria..." : feedback}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button style={styles.btnAction}>
                GENERAR FEEDBACK (RF05)
              </button>
              <button style={{ ...styles.btnAction, background: "#eee", color: "#2d3b45", border: "1px solid #c7cdd1" }}>
                Sincronizar y Publicar en SpeedGrader
              </button>
            </div>
          </div>
        </section>

        {/* History Popup */}
        {showHistory && (
          <div style={styles.historyPopup}>
            <div style={styles.historyHeader}>HISTORIAL DE CALIFICACIONES (Datos de Canvas API)</div>
            <div style={styles.historyBody}>
              <div><strong>Juan Pérez</strong></div>
              <div style={{ fontSize: 12, marginTop: "5px" }}>Taller 1: {prevAvg === 5.8 ? "5.5" : "9.0"}</div>
              <div style={{ fontSize: 12 }}>Control 1: {prevAvg === 5.8 ? "6.0" : "9.5"}</div>
              <div style={{ fontSize: 12 }}>Entrega 1: {prevAvg === 5.8 ? "6.2" : "8.8"}</div>
              <div style={{ fontSize: 13, marginTop: "10px", borderTop: "1px solid #eee", paddingTop: "5px", fontWeight: "bold" }}>
                Trayectoria PREVIA {prevAvg === 5.8 ? "BAJA" : "ALTA"} detectada
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={styles.statusbar}>
        {statusMsg}
      </footer>
    </div>
  );
}
