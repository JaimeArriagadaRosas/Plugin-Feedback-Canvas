import { useState } from "react";
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

const MOCK_DATA = [
  { id: 1, student: "Juan Pérez", grade: "6.5/10", profile: "PROMEDIO", trend: "Estable", status: "EDITADO", feedback: "Buen trabajo..." },
  { id: 2, student: "María García", grade: "9.2/10", profile: "SOBRESALIENTE", trend: "Mejorando", status: "PENDIENTE", feedback: "Excelente desarrollo..." },
  { id: 3, student: "Pedro López", grade: "3.2/10", profile: "EN RIESGO", trend: "Bajando", status: "RECHAZADO", feedback: "Se requiere revisión urgente..." },
];

const PROFILE_COLORS = {
  'SOBRESALIENTE': { bg: '#e9f7ef', text: '#1d8348' },
  'PROMEDIO': { bg: '#ebf5fb', text: '#1a5276' },
  'EN RIESGO': { bg: '#fdedec', text: '#922b21' }
};

export default function FeedbackReviewPanel() {
  const [feedbacks, setFeedbacks] = useState(MOCK_DATA);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [activeFeedback, setActiveFeedback] = useState(null);

  return (
    <div style={styles.wrapper}>
      <main style={styles.main}>
        <h1 style={styles.pageTitle}>PANEL DE REVISIÓN (INTELIGENCIA ACADÉMICA ACTIVA)</h1>

        <div style={styles.tableWrapper}>
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
              {feedbacks.map(fb => (
                <tr key={fb.id}>
                  <td style={styles.td}><strong>{fb.student}</strong></td>
                  <td style={styles.td}>{fb.grade}</td>
                  <td style={styles.td}>
                    <span style={{ 
                      ...styles.profileBadge, 
                      backgroundColor: PROFILE_COLORS[fb.profile].bg, 
                      color: PROFILE_COLORS[fb.profile].text 
                    }}>
                      {fb.profile}
                    </span>
                  </td>
                  <td style={styles.td}>{fb.trend === 'Mejorando' ? '📈' : fb.trend === 'Bajando' ? '📉' : '➖'} {fb.trend}</td>
                  <td style={styles.td}>{fb.status}</td>
                  <td style={styles.td}>
                    <button style={{ cursor: "pointer", background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "4px 8px" }} onClick={() => { setActiveFeedback(fb); setShowApprovalModal(true); }}>🔍 Revisar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <StatusFooter lastSync="19:35:01" count={feedbacks.length} label="Análisis Académico Activo" />

      {showApprovalModal && (
        <ApprovalModal 
          feedback={activeFeedback}
          onConfirm={() => setShowApprovalModal(false)}
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}
