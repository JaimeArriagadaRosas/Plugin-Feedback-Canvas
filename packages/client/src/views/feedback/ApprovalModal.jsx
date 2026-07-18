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
    width: "600px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
    overflow: "hidden",
    fontFamily: "'Lato', sans-serif",
  },
  header: {
    padding: "15px 20px",
    background: "#f0f4f7",
    borderBottom: "1px solid #c7cdd1",
    fontWeight: 700,
    fontSize: 14,
  },
  body: {
    padding: "20px",
    display: "flex",
    gap: "20px",
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    background: "#eee",
    padding: "5px 10px",
    marginBottom: "10px",
    textTransform: "uppercase",
  },
  auditBox: {
    border: "1px solid #c7cdd1",
    padding: "10px",
    fontSize: 12,
    lineHeight: "1.6",
  },
  canvasPreview: {
    border: "1px solid #c7cdd1",
    padding: "10px",
    fontSize: 11,
    background: "#fdfdfd",
  },
  rubricLocal: {
    border: "1px solid #ddd",
    padding: "5px",
    marginBottom: "10px",
    background: "#fff",
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

export default function ApprovalModal({ feedback, onConfirm, onClose }) {
  const [now, setNow] = useState("");
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const d = new Date();
    setNow(d.toLocaleString());
  }, []);

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <div style={styles.header}>APROBACIÓN Y REGISTRO DE FEEDBACK</div>
        <div style={styles.body}>
          <div style={styles.leftCol}>
            <div style={styles.sectionTitle}>REGISTRO DE AUDITORÍA</div>
            <div style={styles.auditBox}>
              <div style={{ color: "#666" }}>(Solo Lectura - Obtenido de BD Local)</div>
              <div style={{ marginTop: "10px" }}>
                <strong>Acción:</strong> Aprobación y Publicación en Canvas<br/>
                <strong>Usuario:</strong> Profr. Elena Ramírez - ID: ER45<br/>
                <strong>Fecha/Hora:</strong> {now}
              </div>
            </div>
          </div>
          <div style={styles.rightCol}>
            <div style={styles.sectionTitle}>DESTINO DEL FEEDBACK (Canvas)</div>
            <div style={styles.canvasPreview}>
              <div style={styles.rubricLocal}>
                <div style={{ borderBottom: "1px solid #eee", paddingBottom: "2px", marginBottom: "5px", fontWeight: "bold" }}>Sets a new standard</div>
                <div style={{ fontSize: "9px", color: "#666" }}>Comments:</div>
                <div style={{ fontWeight: "bold" }}>✓ {feedback?.feedback.substring(0, 50)}...</div>
              </div>
              <div style={{ fontSize: "10px", fontStyle: "italic", color: "#27ae60" }}>
                Feedback guardado como comentario de rúbrica en Canvas.
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "0 20px 10px 20px", fontSize: 13, fontWeight: "bold" }}>
          ¿Qué tan útil o preciso te parece este feedback generado por IA?
          <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
            {[1, 2, 3, 4, 5].map(star => (
              <span 
                key={star} 
                style={{ cursor: "pointer", fontSize: "20px", color: star <= rating ? "#f1c40f" : "#ccc" }}
                onClick={() => setRating(star)}
              >
                ★
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding: "0 20px", fontSize: 11, color: "#666" }}>
          El feedback se guarda como comentario de rúbrica en Canvas. Se registran fecha, hora e ID de usuario en BD local.
        </div>
        <div style={styles.footer}>
          <button style={styles.btnConfirm} onClick={() => onConfirm(rating)}>Confirmar Aprobación</button>
          <button style={styles.btnCancel} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
