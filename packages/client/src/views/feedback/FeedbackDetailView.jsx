import { useState } from "react";
import { api } from "shared/api";
import ConfirmDialog from "../../components/molecules/ConfirmDialog";
import Toast from "../../components/atoms/Toast";
import styles from "./FeedbackDetailView.module.css";
import StudentInfoCard from "./components/StudentInfoCard";
import FeedbackEditor from "./components/FeedbackEditor";
import ActionControls from "./components/ActionControls";

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
        <section className={styles.leftCol}>
          <StudentInfoCard feedback={feedback} />
        </section>

        <section className={styles.centerCol}>
          <FeedbackEditor text={text} setText={setText} />
        </section>

        <section className={styles.rightCol}>
          <ActionControls onApprove={confirmApprove} onSave={handleSave} onBack={onBack} />
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
