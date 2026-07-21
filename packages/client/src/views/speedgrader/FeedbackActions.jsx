import Button from '../../components/atoms/Button';
import StarRating from '../../components/molecules/StarRating';
import styles from './FeedbackGenerator.module.css';

export default function FeedbackActions({
  loading,
  generatedFeedbackId,
  feedback,
  rating,
  setRating,
  handleGenerate,
  handleApprove
}) {
  return (
    <>
      <Button
        variant="primary"
        onClick={handleGenerate}
        disabled={loading}
        className={styles.action}
      >
        {loading ? "GENERANDO..." : "GENERAR FEEDBACK"}
      </Button>

      {generatedFeedbackId && (
        <div className={styles.approveSection} style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <div style={{ marginBottom: '10px' }}>
            <strong>Califica la utilidad de este feedback (obligatorio para mejorar la IA):</strong>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <Button
            variant="success"
            onClick={handleApprove}
            disabled={loading || rating === 0}
            className={styles.action}
            style={{ backgroundColor: '#27ae60', color: '#fff', width: '100%' }}
          >
            2. APROBAR Y ENVIAR AL ESTUDIANTE
          </Button>
        </div>
      )}
    </>
  );
}
