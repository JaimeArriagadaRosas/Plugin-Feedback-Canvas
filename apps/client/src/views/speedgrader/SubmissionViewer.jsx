import React, { useState, useEffect, useRef } from 'react';
import styles from './SubmissionViewer.module.css';
import { isSupportedForPreview } from '../../utils/fileViewer';
import NativePdfViewer from './NativePdfViewer';
import pdfStyles from './NativePdfViewer.module.css';
import QuizViewer from './QuizViewer';
import logger from '../../utils/logger';

const IFRAME_TIMEOUT_MS = 15000; // 15 segundos antes de declarar fallo del iframe

export default function SubmissionViewer({
  submission,
  quizDetails,
  studentName = 'Estudiante',
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
  let submittedAt = 'Sin fecha';
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
      fileName = attachment.filename || attachment.display_name || 'documento';
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
      textBody = "Sin contenido de entrega.";
    }
  } else {
    textBody = "Sin entrega.";
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
            <span className={styles.loadingText}>Cargando entrega de Canvas...</span>
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

    if (!submission) {
      return renderTextCard(textBody);
    }

    if (submission && (submission.workflow_state === 'unsubmitted' || submission.missing)) {
      return (
        <div className={styles.scrollableWrapper}>
          <div className={styles.fallbackCard}>
            <div className={styles.fallbackHeader} style={{ background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)' }}>
              <span className={styles.fallbackIcon}>📝</span>
              <h3 className={styles.fallbackTitle}>Sin Entrega</h3>
            </div>
            <div className={styles.fallbackBody}>
              <p className={styles.fallbackMessage}>
                El estudiante <strong>{studentName}</strong> aún no ha entregado esta tarea.
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
              <h3 className={styles.fallbackTitle}>Recepción Confirmada</h3>
            </div>
            <div className={styles.fallbackBody}>
              <p className={styles.fallbackMessage}>
                La tarea <strong>{fileName}</strong> entregada por <strong>{studentName}</strong> se ha recibido correctamente.
              </p>
              {fileUrl && (
                <a href={fileUrl} target="_blank" rel="noreferrer" className={styles.downloadBtn}>
                  Descargar Tarea
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
        <div className={styles.scrollableWrapper}>
          <QuizViewer quizDetails={quizDetails} studentName={studentName} />
        </div>
      );
    }

    // 3. PRIORIDAD: Contenido de texto/HTML de la entrega (online_text_entry)
    if (hasBody) {
      return renderTextCard(textBody);
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
                <h3 className={styles.fallbackTitle}>Vista Previa No Disponible</h3>
              </div>
              <div className={styles.fallbackBody}>
                <p className={styles.fallbackMessage}>
                  El visor de documentos de Canvas (Canvadocs) no respondió a tiempo.
                  Esto es normal en entornos de <strong>desarrollo local</strong>, ya que el servicio DocViewer
                  es un componente SaaS exclusivo de Instructure.
                </p>
                <p className={styles.fallbackMessage} style={{ fontSize: '0.95rem', color: '#6b7280' }}>
                  En producción, este visor cargará correctamente.
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
              <span className={styles.loadingText}>Cargando vista previa de Canvas...</span>
            </div>
          )}
          <iframe
            src={previewUrl}
            className={`${styles.iframeViewer} ${!iframeLoaded ? styles.hidden : ''}`}
            title={`Entrega de ${studentName}`}
            onLoad={() => {
              setIframeLoaded(true);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
          />
        </div>
      );
    }

    // 5. Fallback final
    return renderTextCard(textBody || "Sin contenido de entrega.");
  };

  return (
    <section className={`${styles.viewer} ${className}`}>
      <div className={styles.meta}>
        <div>
          Entregado el: <strong>{submittedAt}</strong>
        </div>
        <div>
          Intento: <strong>{submission ? submission.attempt || 1 : 'N/A'}</strong>
        </div>
      </div>
      <div className={styles.content}>
        {renderContent()}
      </div>
    </section>
  );
}
