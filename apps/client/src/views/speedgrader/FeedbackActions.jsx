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
  isFeedbackApproved,
  isAiServiceAvailable = true
}) {
  if (!isAiServiceAvailable) {
    return (
      <Button
        variant="primary"
        disabled={true}
        className={styles.action}
        style={{ backgroundColor: '#e2e8f0', color: '#718096', border: '1px solid #cbd5e0' }}
      >
        GENERAR NUEVO FEEDBACK (Deshabilitado - RF64)
      </Button>
    );
  }

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
