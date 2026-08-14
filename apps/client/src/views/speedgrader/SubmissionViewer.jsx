import React, { useState, useEffect, useRef } from 'react';
import styles from './SubmissionViewer.module.css';
import { isSupportedForPreview } from '../../utils/fileViewer';
import NativePdfViewer from './NativePdfViewer';
import pdfStyles from './NativePdfViewer.module.css';
import QuizViewer from './QuizViewer';
import TextEntryViewer from './TextEntryViewer';
import logger from '../../utils/logger';

const IFRAME_TIMEOUT_MS = 15000; // 15 segundos antes de declarar fallo del iframe

export default function SubmissionViewer({
  submission,
  quizDetails,
  studentName = 'Student',
  assignmentName,
  className = '',
  isFetchingSubmission = false,
}) {
  let isUnsupportedFile = false;
  let hasPreviewUrl = false;
  let previewUrl = '';
  let textBody = '';
  let fileName = '';
  let fileUrl = '';
  let submittedAt = 'No date';
  let isFile = false;
  let hasBody = false;

  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const timeoutRef = useRef(null);

  const [textScale, setTextScale] = useState(1.0);
  const zoomOutText = () => setTextScale(prev => Math.max(0.5, prev - 0.1));
  const zoomInText = () => setTextScale(prev => Math.min(3.0, prev + 0.1));

  // Reset iframe states cuando cambia la submission
  useEffect(() => {
    setIframeLoaded(false);
    setIframeTimedOut(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [submission]);

  // Timeout para el iframe: si no carga en 15s, mostrar tarjeta de error
  useEffect(() => {
    if (hasPreviewUrl && !isFile && !hasBody && !iframeLoaded && !iframeTimedOut) {
      timeoutRef.current = setTimeout(() => {
        logger.warn('SubmissionViewer', `Iframe timeout (${IFRAME_TIMEOUT_MS}ms) — preview_url no respondió.`);
        setIframeTimedOut(true);
      }, IFRAME_TIMEOUT_MS);
      return () => clearTimeout(timeoutRef.current);
    }
  }, [hasPreviewUrl, isFile, hasBody, iframeLoaded, iframeTimedOut]);

  if (submission) {
    if (submission.submitted_at) {
      submittedAt = new Date(submission.submitted_at).toLocaleString();
    }
    
    // Revisar si hay adjuntos (attachments)
    if (submission.attachments && submission.attachments.length > 0) {
      const attachment = submission.attachments[0];
      fileName = attachment.filename || attachment.display_name || 'document';
      fileUrl = attachment.url || '';
      isFile = true;
      
      const ext = fileName.split('.').pop().toLowerCase();
      isUnsupportedFile = !isSupportedForPreview(fileName);
    }
    
    // Revisar si hay un enlace de previsualización (Canvadocs)
    if (submission.preview_url) {
      hasPreviewUrl = true;
      previewUrl = submission.preview_url;
    }
    
    // Revisar si hay body HTML
    if (submission.body) {
      hasBody = true;
      textBody = submission.body.replace(/<[^>]+>/g, '');
    } else if (!isFile && !hasPreviewUrl) {
      textBody = "No submission content.";
    }
  } else {
    textBody = "No submission.";
  }

  // Logging de diagnóstico en consola del navegador
  if (submission) {
    const branch = !submission ? 'NO_SUBMISSION'
      : isUnsupportedFile ? 'UNSUPPORTED_FILE'
      : (isFile && fileUrl) ? 'NATIVE_PDF_VIEWER'
      : hasBody ? 'BODY_TEXT'
      : hasPreviewUrl ? 'IFRAME_PREVIEW'
      : 'FALLBACK_EMPTY';
    logger.debug('SubmissionViewer', `Rama: ${branch}`, { type: submission.submission_type || 'N/A', attachments: submission.attachments?.length || 0, hasBody, hasPreviewUrl });
  }

  const renderContent = () => {
    if (isFetchingSubmission) {
      return (
        <div className={styles.iframeWrapper}>
          <div className={styles.skeletonContainer}>
            <span className={styles.loadingText}>Loading Canvas submission...</span>
          </div>
        </div>
      );
    }

    const renderTextCard = (content) => (
      <div className={styles.scrollableWrapper}>
        <div className={styles.paper}>
          <p className={styles.text}>{content}</p>
        </div>
      </div>
    );

    if (!submission || submission.workflow_state === 'unsubmitted' || submission.missing) {
      return (
        <div className={styles.scrollableWrapper}>
          <div className={styles.fallbackCard}>
            <div className={styles.fallbackHeader} style={{ background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)' }}>
              <span className={styles.fallbackIcon}>📝</span>
              <h3 className={styles.fallbackTitle}>No Submission</h3>
            </div>
            <div className={styles.fallbackBody}>
              <p className={styles.fallbackMessage}>
                The student <strong>{studentName}</strong> has not submitted this assignment yet.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // 1. Tarjeta de Contingencia Altamente Estética para archivos no soportados
    if (isUnsupportedFile) {
      return (
        <div className={styles.scrollableWrapper}>
          <div className={styles.fallbackCard}>
            <div className={styles.fallbackHeader}>
              <span className={styles.fallbackIcon}>📦</span>
              <h3 className={styles.fallbackTitle}>Receipt Confirmed</h3>
            </div>
            <div className={styles.fallbackBody}>
              <p className={styles.fallbackMessage}>
                The assignment <strong>{fileName}</strong> submitted by <strong>{studentName}</strong> has been received successfully.
              </p>
              {fileUrl && (
                <a href={fileUrl} target="_blank" rel="noreferrer" className={styles.downloadBtn}>
                  Download Assignment
                </a>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 2. Visor Nativo de PDF (originales o convertidos vía Gotenberg)
    if (isFile && fileUrl) {
      // Usar nuestro proxy interno para conversión a PDF y evadir bloqueos
      const proxyUrl = `/api/courses/file/preview?url=${encodeURIComponent(fileUrl)}`;
      return <NativePdfViewer fileUrl={proxyUrl} />;
    }

    // 2.5. PRIORIDAD: Visor Nativo de Cuestionarios (Quizzes)
    if (submission && submission.submission_type === 'online_quiz') {
      return (
        <div className={styles.textEntryContainer}>
          <QuizViewer quizDetails={quizDetails} studentName={studentName} />
        </div>
      );
    }

    // 3. PRIORIDAD: Contenido de texto/HTML de la entrega (online_text_entry)
    if (hasBody) {
      return (
        <div className={styles.textEntryContainer}>
          <TextEntryViewer 
            submission={submission} 
            studentName={studentName} 
            assignmentName={assignmentName} 
          />
        </div>
      );
    }

    // 4. Último recurso: iframe de preview_url (Canvadocs/DocViewer)
    //    Solo se usa cuando no hay attachments ni body — ej: online_url, student_annotation
    if (hasPreviewUrl) {
      // Si el iframe excedió el timeout, mostrar tarjeta informativa
      if (iframeTimedOut) {
        return (
          <div className={styles.scrollableWrapper}>
            <div className={styles.fallbackCard}>
              <div className={styles.fallbackHeader} style={{ background: 'linear-gradient(135deg, #7c3a12 0%, #b45309 100%)' }}>
                <span className={styles.fallbackIcon}>⏱️</span>
                <h3 className={styles.fallbackTitle}>Preview Not Available</h3>
              </div>
              <div className={styles.fallbackBody}>
                <p className={styles.fallbackMessage}>
                  The Canvas document viewer (Canvadocs) did not respond in time.
                  The service may be experiencing interruptions or your internet connection may be unstable.
                </p>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className={styles.iframeWrapper}>
          {!iframeLoaded && (
            <div className={styles.skeletonContainer}>
              <span className={styles.loadingText}>Loading Canvas preview...</span>
            </div>
          )}
          <iframe
            src={previewUrl}
            className={`${styles.iframeViewer} ${!iframeLoaded ? styles.hidden : ''}`}
            title={`Submission by ${studentName}`}
            onLoad={() => {
              setIframeLoaded(true);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
          />
        </div>
      );
    }

    // 5. Fallback final
    return renderTextCard(textBody || "No submission content.");
  };

  return (
    <section className={`${styles.viewer} ${className}`}>
      <div className={styles.meta}>
        <div>
          Submitted on: <strong>{submittedAt}</strong>
        </div>
        <div>
          Attempt: <strong>{submission ? submission.attempt || 1 : 'N/A'}</strong>
        </div>
      </div>
      <div className={styles.content}>
        {renderContent()}
      </div>
    </section>
  );
}
