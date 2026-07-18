import { useCallback, useState } from 'react';
import Button from '../../components/atoms/Button';
import StarRating from '../../components/molecules/StarRating';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import styles from './FeedbackGenerator.module.css';

export default function FeedbackGenerator({
  loading,
  feedback,
  setFeedback,
  generatedFeedbackId,
  onGenerate,
  onApprove,
  onManualSubmit,
  grade,
  activeAssignment,
  className = '',
}) {
  const logGenerate = useButtonLogger();
  const logApprove = useButtonLogger();
  const [rating, setRating] = useState(0);

  const handleGenerate = useCallback(
    async (e) => {
      setRating(0); // reset rating on new generation
      await logGenerate('SPEEDGRADER_GENERATE_FEEDBACK', () => onGenerate?.())(e);
    },
    [onGenerate, logGenerate]
  );

  const handleApprove = useCallback(
    async (e) => {
      await logApprove('SPEEDGRADER_APPROVE_FEEDBACK', () => onApprove?.(rating))(e);
    },
    [onApprove, logApprove, rating]
  );

  const handleManual = useCallback(
    async (e) => {
      await logApprove('SPEEDGRADER_MANUAL_FEEDBACK', () => onManualSubmit?.(feedback))(e);
    },
    [onManualSubmit, logApprove, feedback]
  );

  return (
    <section className={`${styles.panel} ${className}`}>
      <div className={styles.header}>GENERACIÓN DE FEEDBACK IA</div>
      <div className={styles.body}>
        <div className={styles.context}>
          <strong>Contexto Académico:</strong> La IA analizará la nota actual ({grade}/{activeAssignment?.points}), el historial de notas previas y el texto de la entrega.
        </div>

        <div className={styles.preview}>
          {loading ? (
            "🤖 La IA está orquestando los datos académicos y generando feedback..."
          ) : (
            <textarea 
              value={feedback || ''} 
              onChange={(e) => setFeedback && setFeedback(e.target.value)} 
              className={styles.feedbackEditor} 
              rows={8}
              placeholder="Haz clic en 'Generar Feedback' o escribe tu comentario manual aquí..."
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          )}
        </div>

        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={loading}
          className={styles.action}
        >
          {loading ? "GENERANDO..." : "1. GENERAR FEEDBACK"}
        </Button>

        {generatedFeedbackId ? (
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
        ) : (
          <div className={styles.approveSection} style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <Button
              variant="secondary"
              onClick={handleManual}
              disabled={loading || !feedback}
              className={styles.action}
              style={{ width: '100%' }}
            >
              ENVIAR FEEDBACK MANUAL (SIN IA)
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
