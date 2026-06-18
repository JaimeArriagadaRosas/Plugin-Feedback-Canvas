import { useState, useEffect } from "react";
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
  canvasDocViewer: {
    flex: 1,
    background: "#e0e4e7",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px",
    overflow: "auto",
  },
  paper: {
    width: "100%",
    maxWidth: "800px",
    background: "#fff",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
    padding: "50px",
    minHeight: "600px",
  },
  canvasSidebar: {
    width: "350px",
    background: "#f9f9f9",
    borderLeft: "1px solid #c7cdd1",
    display: "flex",
    flexDirection: "column",
    boxShadow: "-2px 0 10px rgba(0,0,0,0.05)",
  },
  sidebarHeader: {
    padding: "20px",
    borderBottom: "1px solid #c7cdd1",
  },
  bubble: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    padding: "15px",
    margin: "15px",
  },
  studentHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
    borderBottom: "1px solid #eee",
    paddingBottom: "10px",
  },
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "#2d3b45",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
  },
  feedbackText: {
    fontSize: 14,
    lineHeight: "1.6",
    color: "#333",
    whiteSpace: "pre-wrap"
  }
};

export default function StudentFeedbackView({ initialStudentId = 1, onExit }) {
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentRating, setStudentRating] = useState(0);
  const [ratingSaved, setRatingSaved] = useState(false);

  const [viewMode, setViewMode] = useState("list"); // 'list' or 'details'

  // Para poder probar con distintos estudiantes generados
  const [studentId, setStudentId] = useState(initialStudentId);

  useEffect(() => {
    if (initialStudentId) {
      setStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  useEffect(() => {
    const fetchStudentView = async () => {
      try {
        const response = await fetch(`/api/student/feedback/${studentId}`, {
          headers: { 'Authorization': 'Bearer dev-token' }
        });
        const result = await response.json();
        if (result.exito && result.data) {
          setAssignments(result.data);
        }
      } catch (e) {
        console.error("Error fetching student feedback view:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentView();
  }, [studentId]);

  const handleSelectAssignment = (a) => {
    setSelectedFeedback(a);
    setStudentRating(a.feedback?.calificacion_estudiante || 0);
    setRatingSaved(!!a.feedback?.calificacion_estudiante);
    setViewMode("details");
  };

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
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{viewMode === 'list' ? 'CALIFICACIONES' : 'DETALLES DE LA ENTREGA'}</h1>
        </div>
        <div>
          {viewMode === 'details' && (
            <button 
              style={{ background: "#fff", color: "#2d3b45", border: "1px solid #c7cdd1", padding: "8px 20px", borderRadius: "4px", cursor: "pointer", marginRight: "10px" }}
              onClick={() => { setViewMode("list"); setSelectedFeedback(null); }}
            >
              Volver a Calificaciones
            </button>
          )}
          <button 
            style={{ background: "#2d3b45", color: "#fff", border: "none", padding: "8px 20px", borderRadius: "4px", cursor: "pointer" }}
            onClick={onExit}
          >
            Cerrar Vista Estudiante
          </button>
        </div>
      </header>

      <main style={{ ...styles.main, padding: viewMode === 'details' ? 0 : "30px", display: viewMode === 'details' ? "flex" : "block" }}>
        {viewMode === 'list' ? (
          <div>
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
                      onClick={() => handleSelectAssignment(a)}
                    >
                      <span>💬</span> Ver Entrega y Feedback
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        ) : (
          /* PANTALLA DIVIDIDA: DETALLES DE LA ENTREGA (Vista local de Canvas) */
          <>
            <section style={styles.canvasDocViewer}>
              <div style={styles.paper}>
                <h2>Entrega: {selectedFeedback?.name}</h2>
                <p>Estudiante {studentId}</p>
                <hr style={{ border: "0.5px solid #eee", margin: "20px 0" }}/>
                <p style={{ lineHeight: "1.8", color: "#555" }}>
                  (El documento del estudiante aparece aquí en el visor de Canvas...)<br/><br/>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.
                </p>
              </div>
            </section>
            
            <section style={styles.canvasSidebar}>
              <div style={styles.sidebarHeader}>
                <div style={{ fontSize: "18px", fontWeight: "700", marginBottom: "5px" }}>Detalles de la Entrega</div>
                <div style={{ fontSize: "14px", color: "#666" }}>Calificación: <strong>{selectedFeedback?.score} / {selectedFeedback?.total}</strong></div>
              </div>

              <div style={{ padding: "15px", fontWeight: "bold", borderBottom: "1px solid #eee" }}>Comentarios de la Tarea</div>

              <div style={styles.bubble}>
                <div style={styles.studentHeader}>
                  <div style={styles.avatar}>P</div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "700" }}>Profesor del Curso</div>
                    <div style={{ fontSize: "11px", color: "#666" }}>
                      {selectedFeedback?.feedback ? new Date(selectedFeedback.feedback.fecha_generacion).toLocaleString() : ""}
                    </div>
                  </div>
                </div>

                <div style={styles.feedbackText}>
                  {selectedFeedback?.feedback ? selectedFeedback.feedback.contenido_generado : "Cargando feedback..."}
                </div>

                <div style={{ marginTop: "20px", paddingTop: "15px", borderTop: "1px dashed #ccc", textAlign: "center" }}>
                  <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "5px", color: "#0770a3" }}>
                    ⭐ Valora este feedback (Estudiante)
                  </div>
                  <div style={{ display: "flex", gap: "5px", justifyContent: "center" }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <span 
                        key={star} 
                        style={{ cursor: ratingSaved ? "default" : "pointer", fontSize: "28px", color: star <= studentRating ? "#f1c40f" : "#ddd" }}
                        onClick={async () => {
                          if (ratingSaved) return;
                          setStudentRating(star);
                          try {
                            await fetch('/api/student/rate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dev-token' },
                              body: JSON.stringify({ feedbackId: selectedFeedback.feedback.id, rating: star })
                            });
                            setRatingSaved(true);
                            // Actualizar local
                            setAssignments(prev => prev.map(a => {
                              if (a.id === selectedFeedback.id && a.feedback) {
                                a.feedback.calificacion_estudiante = star;
                              }
                              return a;
                            }));
                          } catch (e) {
                            console.error("Error saving rating", e);
                          }
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  {ratingSaved && <div style={{ fontSize: "11px", color: "#27ae60", marginTop: "5px" }}>¡Gracias por tu valoración!</div>}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <StatusFooter 
        lastSync="16:20:10" 
        count={1} 
        label="Vista de Calificaciones local activa" 
      />
    </div>
  );
}
