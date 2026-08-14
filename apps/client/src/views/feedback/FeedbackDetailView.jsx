import ConfirmDialog from "../../components/molecules/ConfirmDialog";
import Toast from "../../components/atoms/Toast";
import styles from "./FeedbackDetailView.module.css";
import StudentInfoCard from "./components/StudentInfoCard";
import FeedbackEditor from "./components/FeedbackEditor";
import ActionControls from "./components/ActionControls";
import { useFeedbackDetail } from "../../hooks/useFeedbackDetail";
import RequirePermission from "../../components/atoms/RequirePermission";

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
    <RequirePermission 
      permission="view_feedback" 
      fallback={<div className={styles.wrapper} style={{ padding: '2rem', textAlign: 'center' }}><h2>Functionality disabled by the administrator.</h2></div>}
    >
      <div className={styles.wrapper}>
        <header className={styles.header}>
        <h1 className={styles.title}>DETAILED FEEDBACK VIEW</h1>
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
        Viewing feedback for {feedback?.student ?? 'Student'} (ID: {feedback?.studentId ?? '-'}). Data synchronized from the local database and Canvas API.
      </footer>
      {showConfirm && (
        <ConfirmDialog
          title="Confirm Publication"
          message="The feedback will be published to SpeedGrader and the student will be notified. This action cannot be undone. Do you wish to continue?"
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
    </RequirePermission>
  );
}
