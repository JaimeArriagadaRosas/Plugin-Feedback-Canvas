import React from 'react';
import FeedbackActions from './FeedbackActions';
import styles from './SpeedGraderAIPanel.module.css';

export default function AIControls({ 
  feedback, 
  loading, 
  generatedFeedbackId, 
  rating, 
  setRating, 
  handleGenerateMassive, 
  handleApprove,
  isFeedbackApproved
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
              <div className={styles.feedbackAdaptiveText}>
                {typeof feedback === 'string' && (feedback.includes('API key not valid') || feedback.includes('API_KEY_INVALID') || feedback.includes('GoogleGenerativeAI Error'))
                  ? 'Por favor, comunícate con tu administrador para configurar una clave o modelo de IA válido en el sistema.'
                  : feedback}
              </div>
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
        handleGenerateMassive={handleGenerateMassive}
        handleApprove={handleApprove}
        isFeedbackApproved={isFeedbackApproved}
      />
    </>
  );
}
