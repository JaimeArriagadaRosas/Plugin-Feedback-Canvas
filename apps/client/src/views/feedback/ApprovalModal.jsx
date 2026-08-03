import { useState, useEffect } from "react";
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';

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
    width: "800px",
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
    padding: "15px",
    fontSize: 12,
    background: "#fdfdfd",
    maxHeight: "250px",
    overflowY: "auto",
  },
  rubricLocal: {
    border: "1px solid #ddd",
    padding: "10px",
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

export default function ApprovalModal({ feedback, onApprove, onReject, onClose, isOpen }) {
  const [now, setNow] = useState("");
  const [rating, setRating] = useState(0);
  const [privateNote, setPrivateNote] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const { user, userName } = useAuth();

  const { data: templates = [] } = useQuery({
    queryKey: ['templates-list-modal'],
    queryFn: async () => {
      const result = await api.get('/templates');
      return result.exito ? result.data : [];
    },
    enabled: isOpen && isRejecting
  });

  useEffect(() => {
    const d = new Date();
    setNow(d.toLocaleString());
  }, []);

  useEffect(() => {
    if (feedback) {
      setRating(feedback.rating || 0);
      setPrivateNote(feedback.nota_privada || "");
      setIsRejecting(false);
      setSelectedTemplate(feedback.templateId || feedback.plantilla_id || "");
    }
  }, [feedback]);

  if (!isOpen) return null;

  const isApproved = feedback?.status === 'APROBADO' || feedback?.status === 'ENVIADO';

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <div style={styles.header}>{isApproved ? 'VALORACIÓN Y NOTAS' : 'APROBACIÓN Y REGISTRO DE FEEDBACK'}</div>
        <div style={styles.body}>
          <div style={styles.leftCol}>
            <div style={styles.sectionTitle}>NOTAS PRIVADAS (SOLO PARA TI)</div>
            <textarea 
              style={{ width: "100%", height: "200px", padding: "10px", fontSize: "12px", border: "1px solid #c7cdd1", borderRadius: "4px", resize: "none" }}
              placeholder="Escribe aquí notas privadas sobre este estudiante o feedback. Esto NO se enviará a Canvas."
              value={privateNote}
              onChange={(e) => setPrivateNote(e.target.value)}
            />
            <div style={{ marginTop: "10px", fontSize: "11px", color: "#666" }}>
                <strong>Acción:</strong> {isApproved ? 'Valoración Post-Envío' : 'Aprobación y Publicación en Canvas'}<br/>
                <strong>Usuario:</strong> {userName || user || "No disponible"}<br/>
                <strong>Fecha/Hora:</strong> {now}
            </div>
          </div>
          <div style={styles.rightCol}>
            <div style={styles.sectionTitle}>DESTINO DEL FEEDBACK (Canvas)</div>
            {!isRejecting ? (
              <>
                <div style={styles.canvasPreview}>
                  <div style={styles.rubricLocal}>
                    <div style={{ borderBottom: "1px solid #eee", paddingBottom: "2px", marginBottom: "5px", fontWeight: "bold" }}>Mejor comentario</div>
                    <div style={{ fontSize: "11px", color: "#666" }}>Comentarios:</div>
                    <div style={{ fontWeight: "bold", whiteSpace: "pre-wrap" }}>✓ {feedback?.feedback || feedback?.contenido_generado}</div>
                  </div>
                  <div style={{ fontSize: "10px", fontStyle: "italic", color: "#27ae60" }}>
                    Feedback guardado como comentario de rúbrica en Canvas.
                  </div>
                </div>
                
                <div style={{ marginTop: "20px", fontSize: 13, fontWeight: "bold" }}>
                  ¿Qué tan útil o preciso te parece este feedback?
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
              </>
            ) : (
              <div style={styles.canvasPreview}>
                <div style={{ fontWeight: "bold", marginBottom: "15px", color: "#c0392b", fontSize: "13px" }}>
                  Rechazar feedback y regenerar uno nuevo
                </div>
                <div style={{ marginBottom: "15px" }}>
                  <div style={{ fontSize: "11px", color: "#666", marginBottom: "5px" }}>Plantilla a utilizar:</div>
                  <select 
                    value={selectedTemplate} 
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    style={{ width: "100%", padding: "8px", border: "1px solid #c7cdd1", borderRadius: "4px", backgroundColor: "#fff" }}
                  >
                    <option value="" disabled>-- Selecciona una plantilla --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre || t.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: "11px", color: "#666" }}>
                  Al hacer clic en "Generar Nuevo Feedback", el feedback actual se marcará como rechazado y se creará uno nuevo automáticamente utilizando la plantilla seleccionada.
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ padding: "0 20px", fontSize: 11, color: "#666", marginBottom: "15px" }}>
          Las notas privadas se guardan de forma aislada en la base de datos local y nunca se sincronizan con Canvas.
        </div>
        <div style={styles.footer}>
          {!isRejecting ? (
            <>
              {(!isApproved && feedback?.status !== 'RECHAZADO') && (
                <button style={{...styles.btnConfirm, background: "#c0392b", marginRight: "10px"}} onClick={() => setIsRejecting(true)}>Rechazar Feedback</button>
              )}
              <button style={styles.btnConfirm} onClick={() => onApprove(rating, privateNote)}>{isApproved ? 'Guardar Cambios' : 'Confirmar Aprobación'}</button>
              <button style={styles.btnCancel} onClick={onClose}>Cancelar</button>
            </>
          ) : (
            <>
              <button 
                style={{...styles.btnConfirm, background: selectedTemplate ? "#0374B5" : "#95a5a6", cursor: selectedTemplate ? "pointer" : "not-allowed"}} 
                disabled={!selectedTemplate} 
                onClick={() => onReject(Number(selectedTemplate))}
              >
                Generar Nuevo Feedback
              </button>
              <button style={styles.btnCancel} onClick={() => setIsRejecting(false)}>Volver</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
