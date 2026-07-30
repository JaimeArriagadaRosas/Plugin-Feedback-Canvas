import ConfirmDialog from "../../components/molecules/ConfirmDialog";
import Toast from "../../components/atoms/Toast";
import styles from "./FeedbackDetailView.module.css";
import StudentInfoCard from "./components/StudentInfoCard";
import FeedbackEditor from "./components/FeedbackEditor";
import ActionControls from "./components/ActionControls";
import { useFeedbackDetail } from "../../hooks/useFeedbackDetail";

export default function FeedbackDetailView({ feedback, onBack }) {
  const {
    text,
    setText,
    showConfirm,
    setShowConfirm,
    toast,
    setToast,
    confirmApprove,
    handleApprove,
    handleSave,
  } = useFeedbackDetail(feedback, onBack);

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
