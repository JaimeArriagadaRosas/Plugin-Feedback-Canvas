import { useState } from "react";
import { api } from "shared/api";
import ConfirmDialog from "../../components/molecules/ConfirmDialog";
import Toast from "../../components/atoms/Toast";
import styles from "./FeedbackDetailView.module.css";

export default function FeedbackDetailView({ feedback, onBack }) {
  const [text, setText] = useState(feedback?.feedback || "");
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  const confirmApprove = () => setShowConfirm(true);

  const handleApprove = async () => {
    setShowConfirm(false);
    try {
      const result = await api.post('/feedback/approve', {
        feedbackId: feedback.id,
        courseId: feedback.courseId,
        assignmentId: feedback.assignmentId,
        studentId: feedback.studentId,
        content: text
      });
      if (result.exito) {
        logger.info('FeedbackDetail', "Feedback aprobado y enviado a Canvas.", { feedbackId: feedback.id });
        setToast({ message: "Feedback aprobado y enviado a Canvas.", type: "success" });
        setTimeout(() => onBack(), 2000);
      } else {
        logger.error('FeedbackDetail', `Error aprobando feedback: ${result.mensaje}`, { feedbackId: feedback.id });
        setToast({ message: "Error: " + result.mensaje, type: "error" });
      }
    } catch (e) {
      logger.error('FeedbackDetail', "Error al intentar aprobar el feedback", { error: e });
      setToast({ message: "Error al intentar aprobar el feedback.", type: "error" });
    }
  };

  const handleSave = async () => {
    try {
      const result = await api.put(`/feedback/${feedback.id}`, { nuevoContenido: text });
      if (result.exito) {
        logger.info('FeedbackDetail', "Edición guardada exitosamente.", { feedbackId: feedback.id });
        setToast({ message: "Edición guardada exitosamente.", type: "success" });
      }
    } catch (e) {
      logger.error('FeedbackDetail', "Error al guardar edición", { error: e });
      setToast({ message: "Error al guardar edición.", type: "error" });
    }
  };

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>VISTA DETALLADA DEL FEEDBACK</h1>
      </header>

      <main className={styles.main}>
        {/* Left Column */}
        <section className={styles.leftCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>INFORMACIÓN DEL ESTUDIANTE</div>
            <div className={styles.cardBody}>
              <div className={styles.studentInfo}>
                <div className={styles.avatar}>👤</div>
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

          <div className={styles.card}>
            <div className={styles.cardHeader}>HISTORIAL DE CALIFICACIONES PREVIAS</div>
            <div className={styles.cardBody}>
              {feedback?.historial && feedback.historial.length > 0 ? (
                feedback.historial.map((h, i) => (
                  <div key={i} className={styles.scoreItem}>
                    <span>Evaluación {i + 1}:</span> <strong>{h.grade || h.nota}</strong>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 13, color: "#666" }}>
                  Datos históricos no disponibles o cargando...
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Center Column */}
        <section className={styles.centerCol}>
          <div className={styles.card} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className={styles.cardHeader}>TEXTO GENERADO PARA EDICIÓN</div>
            <div style={{ padding: "10px 15px", borderBottom: "1px solid #eee", fontSize: 13, background: "#f9f9f9" }}>
              Previsualización y Edición de Feedback
            </div>
            <div className={styles.toolbar}>
              <button className={styles.toolBtn}><b>B</b></button>
              <button className={styles.toolBtn}><i>I</i></button>
              <button className={styles.toolBtn}><u>U</u></button>
              <div style={{ width: "1px", background: "#ddd", margin: "0 5px" }} />
              <button className={styles.toolBtn}>•≡</button>
              <button className={styles.toolBtn}>1≡</button>
              <button className={styles.toolBtn}>≡</button>
              <div style={{ width: "1px", background: "#ddd", margin: "0 5px" }} />
              <button className={styles.toolBtn}>↩</button>
              <button className={styles.toolBtn}>↪</button>
            </div>
            <textarea
              className={styles.editor}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        </section>

        {/* Right Column */}
        <section className={styles.rightCol}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>CONTROLES DE ACCIÓN</div>
            <div className={styles.cardBody}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: "15px" }}>
                <strong>Estado:</strong> Feedback visualizado para revisión.<br />
                Personalización Aplicada.<br />
                <strong>Última Sinc. Local:</strong> 11:30:05
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button className={styles.btnPrimary} onClick={confirmApprove}>APROBAR Y PUBLICAR EN SPEEDGRADER</button>
                <button className={styles.btnSecondary} onClick={handleSave}>GUARDAR EDICIÓN (SIN ENVIAR)</button>
                <button className={styles.btnTertiary} onClick={onBack}>VOLVER A LISTA</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: "#eee", padding: "10px 30px", fontSize: 12, borderTop: "1px solid #ddd" }}>
        Visualizando feedback de {feedback?.student ?? 'Estudiante'} (ID: {feedback?.studentId ?? '-'}). Datos sincronizados de la base de datos local y Canvas API.
      </footer>
      {showConfirm && (
        <ConfirmDialog
          title="Confirmar Publicación"
          message="El feedback será publicado en SpeedGrader y el alumno será notificado. Esta acción no se puede deshacer. ¿Deseas continuar?"
          onConfirm={handleApprove}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
