import { useState, useEffect } from "react";

const styles = {
  overlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2000,
  },
  content: {
    background: "#fff",
    borderRadius: "8px",
    width: "700px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    overflow: "hidden",
    fontFamily: "'Lato', sans-serif",
    display: "flex",
    flexDirection: "column",
    maxHeight: "90vh",
  },
  header: {
    padding: "15px 20px",
    background: "#f0f4f7",
    borderBottom: "1px solid #c7cdd1",
    fontWeight: 700,
    fontSize: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  body: {
    padding: "20px",
    flex: 1,
    overflowY: "auto",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    background: "#eee",
    padding: "5px 10px",
    marginBottom: "10px",
    textTransform: "uppercase",
  },
  textarea: {
    width: "100%",
    minHeight: "300px",
    padding: "15px",
    borderRadius: "4px",
    border: "1px solid #c7cdd1",
    fontSize: "14px",
    fontFamily: "inherit",
    lineHeight: "1.5",
    resize: "vertical",
  },
  footer: {
    padding: "15px 20px",
    textAlign: "right",
    background: "#f9f9f9",
    borderTop: "1px solid #eee",
  },
  btnConfirm: {
    background: "#0770a3",
    color: "#fff",
    border: "none",
    padding: "8px 20px",
    borderRadius: "4px",
    fontWeight: 700,
    cursor: "pointer",
    marginRight: "10px",
  },
  btnCancel: {
    background: "#fff",
    border: "1px solid #c7cdd1",
    padding: "8px 20px",
    borderRadius: "4px",
    cursor: "pointer",
  }
};

export default function EditFeedbackModal({ feedback, onSave, onClose, isOpen }) {
  const [content, setContent] = useState("");

  useEffect(() => {
    if (feedback) {
      setContent(feedback.feedback || "");
    }
  }, [feedback]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <div style={styles.header}>
          <span>EDITAR FEEDBACK DE {feedback?.student?.toUpperCase()}</span>
          <button style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }} onClick={onClose}>&times;</button>
        </div>
        
        <div style={styles.body}>
          <div style={styles.sectionTitle}>EDITOR DE TEXTO INTEGRADO (SOPORTA MARKDOWN BÁSICO)</div>
          
          <div style={{ marginBottom: "15px", display: "flex", gap: "10px", background: "#f5f5f5", padding: "10px", borderRadius: "4px" }}>
            <strong>Estudiante:</strong> {feedback?.student} <br />
            <strong>Calificación:</strong> {feedback?.grade} <br />
            <strong>Perfil (IA):</strong> {feedback?.profile}
          </div>

          <textarea 
            style={styles.textarea}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe el feedback aquí..."
          />
        </div>

        <div style={styles.footer}>
          <button style={styles.btnConfirm} onClick={() => onSave(content)}>Actualizar Feedback</button>
          <button style={styles.btnCancel} onClick={onClose}>Cancelar Cambios</button>
        </div>
      </div>
    </div>
  );
}
