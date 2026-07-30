import Button from '../../components/atoms/Button';
import styles from './FeedbackGenerator.module.css';

export default function FeedbackActions({
  loading,
  generatedFeedbackId,
  feedback,
  rating,
  setRating,
  handleGenerateMassive,
  handleApprove,
  isFeedbackApproved
}) {
  return (
    <>
      {isFeedbackApproved ? (
        <div className={styles.approvedBadge}>
          ✅ Feedback Aprobado y Enviado
        </div>
      ) : (
        <Button
          variant="primary"
          onClick={() => handleGenerateMassive(!!generatedFeedbackId)}
          disabled={loading}
          className={styles.action}
        >
          {loading ? "GENERANDO..." : (generatedFeedbackId ? "REGENERAR FEEDBACK" : "GENERAR FEEDBACK")}
        </Button>
      )}
    </>
  );
}
