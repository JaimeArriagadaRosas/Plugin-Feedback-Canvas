import React, { useRef, Suspense } from 'react';
import { useIntersectionObserver } from './hooks/useIntersectionObserver';
import { resolveContentType, adapters } from './adapters';
import { getContentTypeRenderer } from './registry';
import styles from '../../views/speedgrader/SubmissionViewer.module.css';

/**
 * OptimizeLoadPost (Orchestrator)
 * Applies SOLID, Strategy Pattern, Intersection Observer and React.lazy
 * to optimally load Canvas submission content.
 */
export default function OptimizeLoadPost({
  submission,
  quizDetails,
  studentName = 'Student',
  assignmentName,
  className = '',
  isFetchingSubmission = false,
  isAiServiceAvailable = true,
}) {
  const containerRef = useRef(null);
  const isVisible = useIntersectionObserver(containerRef, {
    triggerOnce: true,
    rootMargin: '200px 0px', // Starts rendering 200px before entering the screen
  });

  const payload = { submission, quizDetails, studentName, assignmentName };
  
  // 1. Determine strategy
  let contentType = resolveContentType(submission);
  if (!isAiServiceAvailable) {
    contentType = 'readonly_mode';
  }
  
  // 2. Extract clean props through the corresponding adapter
  const adapter = adapters[contentType] || adapters['fallback_empty'];
  const adapterProps = adapter(payload, contentType);

  const renderSkeleton = () => (
    <div className={styles.iframeWrapper}>
      <div className={styles.skeletonContainer}>
        <span className={styles.loadingText}>Loading Canvas submission...</span>
      </div>
    </div>
  );

  return (
    <section className={`${styles.viewer} ${className}`} ref={containerRef}>
      <div className={styles.meta}>
        <div>
          Submitted on: <strong>{adapterProps.submittedAt}</strong>
        </div>
        <div>
          Attempt: <strong>{adapterProps.attempt}</strong>
        </div>
      </div>
      <div className={styles.content}>
        {isFetchingSubmission ? (
          renderSkeleton()
        ) : !isVisible ? (
          // Placeholder while not in the viewport
          <div style={{ minHeight: '300px' }}>
            {renderSkeleton()}
          </div>
        ) : (
          // 3. Render dynamically based on strategy
          <Suspense fallback={<div style={{ minHeight: '300px' }}>{renderSkeleton()}</div>}>
            {React.createElement(getContentTypeRenderer(contentType), adapterProps)}
          </Suspense>
        )}
      </div>
    </section>
  );
}
