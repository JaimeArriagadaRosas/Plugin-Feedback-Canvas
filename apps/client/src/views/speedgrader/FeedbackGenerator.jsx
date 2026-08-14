import { useCallback, useState } from 'react';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import FeedbackActions from './FeedbackActions';
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
  isFeedbackApproved
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
      <div className={styles.header}>AI FEEDBACK GENERATION</div>
      <div className={styles.body}>
        <div className={styles.context}>
          <strong>Academic Context:</strong> The AI will analyze the current grade ({grade}/{activeAssignment?.points}), previous grade history, and the submission text.
        </div>

        <div className={styles.preview}>
          {loading ? (
            "🤖 The AI is orchestrating academic data and generating feedback..."
          ) : (
            <textarea 
              value={feedback || ''} 
              onChange={(e) => setFeedback && setFeedback(e.target.value)} 
              className={styles.feedbackEditor} 
              rows={8}
              placeholder="Click 'Generate Feedback' or write your manual comment here..."
              style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: isFeedbackApproved ? '#f3f4f6' : 'white' }}
              readOnly={isFeedbackApproved}
            />
          )}
        </div>

        <FeedbackActions
          loading={loading}
          generatedFeedbackId={generatedFeedbackId}
          feedback={feedback}
          rating={rating}
          setRating={setRating}
          handleGenerate={handleGenerate}
          handleApprove={handleApprove}
          handleManual={handleManual}
          isFeedbackApproved={isFeedbackApproved}
        />
      </div>
    </section>
  );
}
