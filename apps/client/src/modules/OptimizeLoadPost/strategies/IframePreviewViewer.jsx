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
        logger.warn('IframePreviewViewer', `Iframe timeout (${IFRAME_TIMEOUT_MS}ms) — preview_url did not respond.`);
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
            <h3 className={styles.fallbackTitle}>Preview Not Available</h3>
          </div>
          <div className={styles.fallbackBody}>
            <p className={styles.fallbackMessage}>
              The Canvas document viewer (Canvadocs) did not respond in time.
              This is normal in <strong>local development</strong> environments, as the DocViewer service
              is an exclusive SaaS component of Instructure.
            </p>
            <p className={styles.fallbackMessage} style={{ fontSize: '0.95rem', color: '#6b7280' }}>
              In production, this viewer will load correctly.
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
