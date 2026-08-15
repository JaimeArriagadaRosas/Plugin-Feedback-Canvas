import React, { useState, useEffect, useRef } from 'react';
import styles from './SubmissionViewer.module.css';
import { isSupportedForPreview } from '../../utils/fileViewer';
import NativePdfViewer from './NativePdfViewer';
import pdfStyles from './NativePdfViewer.module.css';
import QuizViewer from './QuizViewer';
import TextEntryViewer from './TextEntryViewer';
import logger from '../../utils/logger';

const IFRAME_TIMEOUT_MS = 15000; // 15 seconds before declaring iframe failure

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

  // Reset iframe states when submission changes
  useEffect(() => {
    setIframeLoaded(false);
    setIframeTimedOut(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [submission]);

  // Iframe timeout: if it doesn't load in 15s, show error card
  useEffect(() => {
    if (hasPreviewUrl && !isFile && !hasBody && !iframeLoaded && !iframeTimedOut) {
      timeoutRef.current = setTimeout(() => {
        logger.warn('SubmissionViewer', `Iframe timeout (${IFRAME_TIMEOUT_MS}ms) — preview_url did not respond.`);
        setIframeTimedOut(true);
      }, IFRAME_TIMEOUT_MS);
      return () => clearTimeout(timeoutRef.current);
    }
  }, [hasPreviewUrl, isFile, hasBody, iframeLoaded, iframeTimedOut]);

  if (submission) {
    if (submission.submitted_at) {
      submittedAt = new Date(submission.submitted_at).toLocaleString();
    }
    
    // Check if there are attachments
    if (submission.attachments && submission.attachments.length > 0) {
      const attachment = submission.attachments[0];
      fileName = attachment.filename || attachment.display_name || 'document';
      fileUrl = attachment.url || '';
      isFile = true;
      
      const ext = fileName.split('.').pop().toLowerCase();
      isUnsupportedFile = !isSupportedForPreview(fileName);
    }
    
    // Check if there is a preview link (Canvadocs)
    if (submission.preview_url) {
      hasPreviewUrl = true;
      previewUrl = submission.preview_url;
    }
    
    // Check if there is an HTML body
    if (submission.body) {
      hasBody = true;
      textBody = submission.body.replace(/<[^>]+>/g, '');
    } else if (!isFile && !hasPreviewUrl) {
      textBody = "No submission content.";
    }
  } else {
    textBody = "No submission.";
  }

  // Diagnostic logging in the browser console
  if (submission) {
    const branch = !submission ? 'NO_SUBMISSION'
      : isUnsupportedFile ? 'UNSUPPORTED_FILE'
      : (isFile && fileUrl) ? 'NATIVE_PDF_VIEWER'
      : hasBody ? 'BODY_TEXT'
      : hasPreviewUrl ? 'IFRAME_PREVIEW'
      : 'FALLBACK_EMPTY';
    logger.debug('SubmissionViewer', `Branch: ${branch}`, { type: submission.submission_type || 'N/A', attachments: submission.attachments?.length || 0, hasBody, hasPreviewUrl });
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

    // 1. Highly Aesthetic Contingency Card for unsupported files
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

    // 2. Native PDF Viewer (original or converted via Gotenberg)
    if (isFile && fileUrl) {
      // Use our internal proxy for PDF conversion to evade blocks
      const proxyUrl = `/api/courses/file/preview?url=${encodeURIComponent(fileUrl)}`;
      return <NativePdfViewer fileUrl={proxyUrl} />;
    }

    // 2.5. PRIORITY: Native Quiz Viewer
    if (submission && submission.submission_type === 'online_quiz') {
      return (
        <div className={styles.textEntryContainer}>
          <QuizViewer quizDetails={quizDetails} studentName={studentName} />
        </div>
      );
    }

    // 3. PRIORITY: Text/HTML content of the submission (online_text_entry)
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

    // 4. Last resort: preview_url iframe (Canvadocs/DocViewer)
    //    Only used when there are no attachments or body — e.g. online_url, student_annotation
    if (hasPreviewUrl) {
      // If the iframe exceeded the timeout, show info card
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

    // 5. Final fallback
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
