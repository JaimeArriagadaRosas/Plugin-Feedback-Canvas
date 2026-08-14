import React from 'react';
import FeedbackActions from './FeedbackActions';
import styles from './SpeedGraderAIPanel.module.css';
import { RichTextProcessor } from '../../utils/RichTextProcessor';

export default function AIControls({ 
  feedback, 
  loading, 
  generatedFeedbackId, 
  rating, 
  setRating, 
  handleGenerateMassive, 
  handleApprove,
  isFeedbackApproved,
  isAiServiceAvailable
}) {
  return (
    <>
      <section className={styles.feedbackAdaptivePanel}>
        <div className={styles.feedbackAdaptiveHeader}>
          UNIDA ADAPTIVE FEEDBACK (AI)
        </div>
        <div className={styles.feedbackAdaptiveBody}>
          {feedback ? (
            <>
              <div className={styles.feedbackAdaptiveText} style={{ whiteSpace: 'pre-wrap' }}>
                {typeof feedback === 'string' && (feedback.includes('API key not valid') || feedback.includes('API_KEY_INVALID') || feedback.includes('GoogleGenerativeAI Error'))
                  ? 'Please contact your administrator to configure a valid AI key or model in the system.'
                  : RichTextProcessor.process(feedback)}
              </div>
            </>
          ) : (
            <div className={styles.feedbackPlaceholder}>
              The generated feedback review for the student will be displayed here.
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
        isAiServiceAvailable={isAiServiceAvailable}
      />
    </>
  );
}
