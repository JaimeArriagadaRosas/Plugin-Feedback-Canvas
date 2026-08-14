import React, { useRef, Suspense } from 'react';
import { useIntersectionObserver } from './hooks/useIntersectionObserver';
import { resolveContentType, adapters } from './adapters';
import { getContentTypeRenderer } from './registry';
import styles from '../../views/speedgrader/SubmissionViewer.module.css';

/**
 * OptimizeLoadPost (Orchestrator)
 * Aplica SOLID, Patrón Strategy, Intersection Observer y React.lazy
 * para cargar de forma óptima el contenido de las entregas de Canvas.
 */
export default function OptimizeLoadPost({
  submission,
  quizDetails,
  studentName = 'Estudiante',
  assignmentName,
  className = '',
  isFetchingSubmission = false,
  isAiServiceAvailable = true,
}) {
  const containerRef = useRef(null);
  const isVisible = useIntersectionObserver(containerRef, {
    triggerOnce: true,
    rootMargin: '200px 0px', // Empieza a renderizar 200px antes de entrar a la pantalla
  });

  const payload = { submission, quizDetails, studentName, assignmentName };
  
  // 1. Determinar la estrategia
  let contentType = resolveContentType(submission);
  if (!isAiServiceAvailable) {
    contentType = 'readonly_mode';
  }
  
  // 2. Extraer props limpias a través del adaptador correspondiente
  const adapter = adapters[contentType] || adapters['fallback_empty'];
  const adapterProps = adapter(payload, contentType);

  const renderSkeleton = () => (
    <div className={styles.iframeWrapper}>
      <div className={styles.skeletonContainer}>
        <span className={styles.loadingText}>Cargando entrega de Canvas...</span>
      </div>
    </div>
  );

  return (
    <section className={`${styles.viewer} ${className}`} ref={containerRef}>
      <div className={styles.meta}>
        <div>
          Entregado el: <strong>{adapterProps.submittedAt}</strong>
        </div>
        <div>
          Intento: <strong>{adapterProps.attempt}</strong>
        </div>
      </div>
      <div className={styles.content}>
        {isFetchingSubmission ? (
          renderSkeleton()
        ) : !isVisible ? (
          // Placeholder mientras no está en el viewport
          <div style={{ minHeight: '300px' }}>
            {renderSkeleton()}
          </div>
        ) : (
          // 3. Renderizar dinámicamente según la estrategia
          <Suspense fallback={<div style={{ minHeight: '300px' }}>{renderSkeleton()}</div>}>
            {React.createElement(getContentTypeRenderer(contentType), adapterProps)}
          </Suspense>
        )}
      </div>
    </section>
  );
}
