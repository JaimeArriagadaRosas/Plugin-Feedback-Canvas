import { useState } from "react";
import StatusFooter from "../cursos/StatusFooter";
import ApprovalModal from "./ApprovalModal";

const styles = {
  wrapper: {
    fontFamily: "'Lato', sans-serif",
    fontSize: 14,
    color: "#2d3b45",
    background: "#f5f5f5",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    paddingBottom: "40px",
  },
  main: {
    flex: 1,
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
  filterField: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  label: {
    fontWeight: 700,
    fontSize: 13,
  },
  select: {
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
    width: "250px",
  },
  btnApply: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    borderRadius: "4px",
    cursor: "pointer",
    fontWeight: 700,
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
    fontSize: 12,
    textTransform: "uppercase",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #e0e4e8",
    verticalAlign: "middle",
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
  },
  legend: {
    padding: "10px 15px",
    background: "#eee",
    borderTop: "1px solid #c7cdd1",
    display: "flex",
    alignItems: "center",
    gap: "15px",
    fontSize: 12,
  },
  actionBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "16px",
    marginRight: "8px",
    padding: "5px",
    borderRadius: "4px",
    border: "1px solid transparent",
  }
};

const STATUS_CONFIG = {
  PENDIENTE: { label: "Pendiente", color: "#b9770e", bg: "#fef9e7", icon: "🕒" },
  APROBADO: { label: "Aprobado", color: "#1d8348", bg: "#e9f7ef", icon: "✔" },
  EDITADO: { label: "Editado", color: "#1a5276", bg: "#ebf5fb", icon: "✎" },
  RECHAZADO: { label: "Rechazado", color: "#922b21", bg: "#fdedec", icon: "✘" },
};

const MOCK_DATA = [
  { id: 1, student: "Juan Pérez", grade: "6/10", trajectory: "Apoyo", range: "Logrado (6-10)", status: "EDITADO", feedback: "Excellent..." },
  { id: 2, student: "María García", grade: "8/10", trajectory: "Mejora", range: "Logrado (6-10)", status: "PENDIENTE", feedback: "Great..." },
  { id: 3, student: "Pedro López", grade: "3.9/10", trajectory: "Retroceso", range: "Inferior a 4.0", status: "RECHAZADO", feedback: "Needs work..." },
];

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDIENTE;
  return (
    <div style={{ ...styles.chip, color: config.color, background: config.bg, border: `1px solid ${config.color}44` }}>
      {config.label} {config.icon}
    </div>
  );
}

export default function FeedbackReviewPanel({ onEditFeedback }) {
  const [feedbacks, setFeedbacks] = useState(MOCK_DATA);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);

  const updateStatus = (id, newStatus) => {
    setFeedbacks(feedbacks.map(fb => fb.id === id ? { ...fb, status: newStatus } : fb));
  };

  const handleApprove = (fb) => {
    setActiveFeedback(fb);
    setShowApprovalModal(true);
  };

  const confirmApproval = () => {
    if (activeFeedback) {
      updateStatus(activeFeedback.id, 'APROBADO');
    }
    setShowApprovalModal(false);
  };

  const toggleSelect = (id) => {
    setSelectedIds(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
  };

  return (
    <div style={styles.wrapper}>
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>PANEL DE REVISIÓN DE FEEDBACKS - RF30/RF26</h1>

        <section style={styles.filterSection}>
          <div style={styles.filterField}><label style={styles.label}>Filtrar por Curso</label><select style={styles.select}><option>ISWII - Sección 1</option></select></div>
          <div style={styles.filterField}><label style={styles.label}>Filtrar por Asignación</label><select style={styles.select}><option>Control 1: Diagramas de Clase</option></select></div>
          <button style={styles.btnApply}>Aplicar Filtros</button>
        </section>

        <div style={styles.tableWrapper}>
          <div style={{ padding: "12px 15px", background: "#f0f4f7", fontWeight: 700, borderBottom: "1px solid #c7cdd1" }}>
            LISTA DE FEEDBACKS PENDIENTES DE REVISIÓN (RF26)
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: "50px", textAlign: "center" }}>Sel.</th>
                <th style={styles.th}>Estudiante</th>
                <th style={styles.th}>Calificación</th>
                <th style={styles.th}>Trayectoria</th>
                <th style={styles.th}>Estado / Rango</th>
                <th style={styles.th}>Previsualización</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {feedbacks.map(fb => (
                <tr key={fb.id}>
                  <td style={{ ...styles.td, textAlign: "center" }}><input type="checkbox" checked={selectedIds.includes(fb.id)} onChange={() => toggleSelect(fb.id)} /></td>
                  <td style={styles.td}>{fb.student}</td>
                  <td style={styles.td}>{fb.grade}</td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ fontSize: 20, color: fb.trajectory === "Mejora" ? "green" : fb.trajectory === "Retroceso" ? "red" : "orange" }}>
                        {fb.trajectory === "Mejora" ? "✔" : fb.trajectory === "Retroceso" ? "✘" : "⬆"}
                      </span>
                      <span style={{ fontSize: 10 }}>{fb.trajectory}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <StatusBadge status={fb.status} />
                      <div style={{ fontSize: 11, color: "#666" }}>{fb.range}</div>
                    </div>
                  </td>
                  <td style={styles.td}><div style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fb.feedback}</div></td>
                  <td style={styles.td}>
                    <div style={{ display: "flex" }}>
                      <button style={styles.actionBtn} title="Editar/Sincronizar" onClick={() => handleApprove(fb)}>📝</button>
                      <button style={styles.actionBtn} title="Ignorar" onClick={() => updateStatus(fb.id, 'RECHAZADO')}>🚫</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={styles.legend}>
            <strong>LEYENDA DE ESTADOS DE FEEDBACK (RF30):</strong>
            <div style={{ display: "flex", gap: "10px" }}>
              <span style={{ ...styles.chip, background: "#fef9e7", color: "#b9770e", border: "1px solid #b9770e" }}>[Pendiente]</span>
              <span style={{ ...styles.chip, background: "#e9f7ef", color: "#1d8348", border: "1px solid #1d8348" }}>[Aprobado]</span>
              <span style={{ ...styles.chip, background: "#ebf5fb", color: "#1a5276", border: "1px solid #1a5276" }}>[Editado]</span>
              <span style={{ ...styles.chip, background: "#fdedec", color: "#922b21", border: "1px solid #922b21" }}>[Rechazado]</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "20px", textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "15px" }}>
          <button style={{ background: "#eee", border: "1px solid #c7cdd1", padding: "12px 25px", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>IGNORAR SELECCIONADOS</button>
          <button style={{ background: "#0770a3", color: "#fff", border: "none", padding: "12px 25px", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>APROBAR Y PUBLICAR SELECCIONADOS EN SPEEDGRADER</button>
        </div>
      </main>

      <StatusFooter lastSync="11:40:01" count={feedbacks.length} label="Pendientes RF26" />

      {showApprovalModal && (
        <ApprovalModal 
          feedback={activeFeedback}
          onConfirm={confirmApproval}
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}
