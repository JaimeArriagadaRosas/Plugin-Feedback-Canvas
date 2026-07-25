import React from 'react';
import FeedbackActions from './FeedbackActions';
import styles from './SpeedGraderAIPanel.module.css';

export default function AIControls({ 
  feedback, 
  loading, 
  generatedFeedbackId, 
  rating, 
  setRating, 
  handleGenerate, 
  handleApprove 
}) {
  return (
    <>
      <section className={styles.feedbackAdaptivePanel}>
        <div className={styles.feedbackAdaptiveHeader}>
          UNIDA FEEDBACK ADAPTATIVO (IA)
        </div>
        <div className={styles.feedbackAdaptiveBody}>
          {feedback ? (
            <>
              <div className={styles.feedbackTag}>FEEDBACK PARA TRAYECTORIA DE MEJORA</div>
              <div className={styles.feedbackAdaptiveText}>{feedback}</div>
            </>
          ) : (
            <div className={styles.feedbackPlaceholder}>
              Aquí se visualizará la review del feedback generado para el estudiante.
            </div>
          )}
        </div>
      </section>

      <FeedbackActions
        loading={loading}
        generatedFeedbackId={generatedFeedbackId}
        feedback={feedback}
        rating={rating}
        setRating={setRating}
        handleGenerate={handleGenerate}
        handleApprove={handleApprove}
      />
    </>
  );
}
