import React, { useState, useEffect, useRef } from 'react';
import styles from '../../../views/speedgrader/SubmissionViewer.module.css';
import logger from '../../../utils/logger';

const IFRAME_TIMEOUT_MS = 15000;

export default function IframePreviewViewer({ previewUrl, studentName }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeTimedOut, setIframeTimedOut] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!iframeLoaded && !iframeTimedOut) {
      timeoutRef.current = setTimeout(() => {
        logger.warn('IframePreviewViewer', `Iframe timeout (${IFRAME_TIMEOUT_MS}ms) — preview_url no respondió.`);
        setIframeTimedOut(true);
      }, IFRAME_TIMEOUT_MS);
      return () => clearTimeout(timeoutRef.current);
    }
  }, [iframeLoaded, iframeTimedOut]);

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
