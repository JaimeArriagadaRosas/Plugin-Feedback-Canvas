import { useState, useEffect } from "react";
import StatusFooter from "../cursos/StatusFooter";
import ApprovalModal from "./ApprovalModal";

const styles = {
  wrapper: {
    fontFamily: "'Lato', sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#f5f5f5",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
  },
  main: {
    padding: "24px 30px",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 25,
    borderBottom: "2px solid #2d3b45",
    paddingBottom: "10px",
  },
  filterSection: {
    display: "flex",
    gap: "20px",
    background: "#fff",
    padding: "15px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
    marginBottom: "20px",
    alignItems: "flex-end",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  filterLabel: {
    fontWeight: "bold",
    fontSize: "12px",
    color: "#555",
  },
  filterSelect: {
    padding: "8px 12px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
    background: "#fff",
    minWidth: "180px",
    fontSize: "13px",
    outline: "none",
  },
  tableWrapper: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    borderRadius: "4px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    background: "#f0f4f7",
    padding: "12px",
    textAlign: "left",
    fontWeight: 700,
    borderBottom: "2px solid #c7cdd1",
    fontSize: 11,
    textTransform: "uppercase",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e0e4e8",
    verticalAlign: "middle",
  },
  profileBadge: {
    padding: "2px 8px",
    borderRadius: "10px",
    fontSize: "10px",
    fontWeight: "bold",
    textTransform: "uppercase"
  },
  chip: {
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    minWidth: "80px",
    justifyContent: "center",
  }
};

const PROFILE_COLORS = {
  'SOBRESALIENTE': { bg: '#e9f7ef', text: '#1d8348' },
  'PROMEDIO': { bg: '#ebf5fb', text: '#1a5276' },
  'EN RIESGO': { bg: '#fdedec', text: '#922b21' }
};

const STATUS_COLORS = {
  'PENDIENTE': { bg: '#fef9e7', text: '#b58900' },
  'EDITADO': { bg: '#eef2f7', text: '#475569' },
  'APROBADO': { bg: '#e9f7ef', text: '#1d8348' },
  'RECHAZADO': { bg: '#fdedec', text: '#922b21' }
};

export default function FeedbackReviewPanel({ onEditFeedback }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);

  // Filtros dinámicos (CU23)
  const [selectedCourse, setSelectedCourse] = useState("Todos");
  const [selectedAssignment, setSelectedAssignment] = useState("Todas");

  const coursesList = ["Todos", ...new Set(feedbacks.map(fb => fb.courseId).filter(Boolean))];
  const assignmentsList = ["Todas", ...new Set(feedbacks.map(fb => fb.assignmentId).filter(Boolean))];

  const filteredFeedbacks = feedbacks.filter(fb => {
    const matchCourse = selectedCourse === "Todos" || String(fb.courseId) === String(selectedCourse);
    const matchAssignment = selectedAssignment === "Todas" || String(fb.assignmentId) === String(selectedAssignment);
    return matchCourse && matchAssignment;
  });

  const fetchFeedbacks = async () => {
    try {
      const response = await fetch('/api/feedback/list', {
        headers: { 'Authorization': 'Bearer dev-token' }
      });
      const result = await response.json();
      if (result.exito && result.data) {
        setFeedbacks(result.data);
      }
    } catch (e) {
      console.error("Error al obtener feedbacks:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (rating) => {
    if (!activeFeedback) return;
    try {
      const response = await fetch('/api/feedback/approve', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-token' 
        },
        body: JSON.stringify({
          feedbackId: activeFeedback.id,
          courseId: activeFeedback.courseId,
          assignmentId: activeFeedback.assignmentId,
          studentId: activeFeedback.studentId,
          content: activeFeedback.feedback,
          rating: rating || null
        })
      });
      const result = await response.json();
      if (result.exito) {
        setShowApprovalModal(false);
        fetchFeedbacks(); // Refrescar lista para ver el cambio de estado
      } else {
        alert("Error: " + result.mensaje);
      }
    } catch (e) {
      console.error("Error al aprobar:", e);
      alert("Error al intentar aprobar el feedback.");
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleExportCSV = () => {
    const header = "Estudiante,Curso,Asignacion,Estado,Calificacion IA,Perfil Academico\n";
    const rows = filteredFeedbacks.map(fb => 
      `${fb.student},${fb.courseId},${fb.assignmentId},${fb.status},${fb.grade},${fb.profile}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "reporte_feedbacks.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={styles.wrapper}>
      <main style={styles.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, borderBottom: "2px solid #2d3b45", paddingBottom: "10px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>PANEL DE REVISIÓN (INTELIGENCIA ACADÉMICA ACTIVA)</h1>
          <button 
            style={{ padding: "8px 15px", background: "#27ae60", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            onClick={handleExportCSV}
          >
            📊 Exportar Reporte CSV
          </button>
        </div>

        {/* Sección de Filtros (CU23) */}
        <div style={styles.filterSection}>
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Filtrar por Curso</label>
            <select 
              style={styles.filterSelect} 
              value={selectedCourse} 
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setSelectedAssignment("Todas"); // Resetear asignación para evitar inconsistencias
              }}
            >
              {coursesList.map(course => (
                <option key={course} value={course}>
                  {course === "Todos" ? "Todos los Cursos" : `Curso ID: ${course}`}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>Filtrar por Asignación</label>
            <select 
              style={styles.filterSelect} 
              value={selectedAssignment} 
              onChange={(e) => setSelectedAssignment(e.target.value)}
            >
              {assignmentsList.map(assign => (
                <option key={assign} value={assign}>
                  {assign === "Todas" ? "Todas las Asignaciones" : `Tarea ID: ${assign}`}
                </option>
              ))}
            </select>
          </div>

          {(selectedCourse !== "Todos" || selectedAssignment !== "Todas") && (
            <button 
              style={{
                padding: "8px 15px",
                background: "#f0f4f7",
                border: "1px solid #c7cdd1",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "bold",
                color: "#2d3b45",
                transition: "all 0.2s"
              }}
              onClick={() => {
                setSelectedCourse("Todos");
                setSelectedAssignment("Todas");
              }}
            >
              Limpiar Filtros
            </button>
          )}
        </div>

        <div style={styles.tableWrapper}>
          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#666" }}>
              🤖 Cargando feedbacks de la base de datos...
            </div>
          ) : feedbacks.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#666" }}>
              No se han encontrado feedbacks generados aún. Ve a SpeedGrader para generar uno.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Estudiante</th>
                  <th style={styles.th}>Calificación</th>
                  <th style={styles.th}>Perfil Académico (IA)</th>
                  <th style={styles.th}>Tendencia</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeedbacks.map(fb => (
                  <tr key={fb.id}>
                    <td style={styles.td}><strong>{fb.student}</strong></td>
                    <td style={styles.td}>{fb.grade}</td>
                    <td style={styles.td}>
                      <span style={{ 
                        ...styles.profileBadge, 
                        backgroundColor: PROFILE_COLORS[fb.profile]?.bg || '#eee', 
                        color: PROFILE_COLORS[fb.profile]?.text || '#333' 
                      }}>
                        {fb.profile}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {fb.trend === 'Mejorando' ? '📈' : fb.trend === 'Bajando' ? '📉' : '➖'} {fb.trend}
                    </td>
                    <td style={styles.td}>
                      <span style={{ 
                        ...styles.chip, 
                        backgroundColor: STATUS_COLORS[fb.status]?.bg || '#eee', 
                        color: STATUS_COLORS[fb.status]?.text || '#333',
                        border: `1px solid ${STATUS_COLORS[fb.status]?.text || '#ccc'}33`
                      }}>
                        {fb.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button 
                          style={{ cursor: "pointer", background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "4px 8px" }} 
                          onClick={() => { setActiveFeedback(fb); setShowApprovalModal(true); }}
                        >
                          🔍 Revisar
                        </button>
                        <button 
                          style={{ cursor: "pointer", background: "#0770a3", color: "#fff", border: "none", borderRadius: 4, padding: "4px 8px", fontWeight: "bold" }} 
                          onClick={() => onEditFeedback && onEditFeedback(fb)}
                        >
                          ✏️ Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      <StatusFooter lastSync="En Tiempo Real" count={feedbacks.length} label="Análisis Académico Activo" isConnected={true} />

      {showApprovalModal && (
        <ApprovalModal 
          feedback={activeFeedback}
          onConfirm={handleApprove}
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}
