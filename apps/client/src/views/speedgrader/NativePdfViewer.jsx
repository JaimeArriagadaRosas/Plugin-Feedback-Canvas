import React, { useState } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import styles from './NativePdfViewer.module.css';

// Configure the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PdfSkeleton = () => (
  <div className={styles.skeletonContainer}>
    <span className={styles.loadingText}>Processing document...</span>
  </div>
);

const NativePdfViewer = ({ fileUrl }) => {
  const options = React.useMemo(() => ({ withCredentials: true }), []);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    console.log(`[NativePdfViewer] Starting document load proxyUrl: ${fileUrl}`);
    console.time('PDF_Load_Time');
    return () => {
      // If the component unmounts before loading, we'll clear the timer (although it might give a warning in console, it's preferable)
    };
  }, [fileUrl]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    console.timeEnd('PDF_Load_Time');
    setNumPages(numPages);
    setError(null);
  };

  const onDocumentLoadError = (err) => {
    console.error('[NativePdfViewer] Error loading PDF:', err);
    try { console.timeEnd('PDF_Load_Time'); } catch (e) {} // Avoid error if there was no active timer
    setError('Could not load document.');
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  const zoomOut = () => setScale(prev => Math.max(0.5, prev - 0.1));
  const zoomIn = () => setScale(prev => Math.min(3.0, prev + 0.1));

  if (error) {
    return <div className={styles.errorContainer}>{error}</div>;
  }

  return (
    <div className={styles.pdfContainer}>
      <div className={styles.toolbar}>
        <button 
          disabled={pageNumber <= 1} 
          onClick={previousPage}
          className={styles.iconBtn}
          title="Previous Page"
        >
          &lt;
        </button>
        <div className={styles.pageGroup}>
          <span className={styles.pageInput}>{pageNumber || (numPages ? 1 : '--')}</span> 
          <span className={styles.pageTotal}>/ {numPages || '--'}</span>
        </div>
        <button
          disabled={pageNumber >= numPages}
          onClick={nextPage}
          className={styles.iconBtn}
          title="Next Page"
        >
          &gt;
        </button>

        <div className={styles.separator} />

        <div className={styles.zoomGroup}>
          <button onClick={zoomOut} className={styles.iconBtn} title="Zoom Out">-</button>
          <span className={styles.zoomText}>{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className={styles.iconBtn} title="Zoom In">+</button>
        </div>
      </div>
      <div className={styles.documentWrapper}>
        <Document
          file={fileUrl}
          options={options}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<PdfSkeleton />}
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className={styles.pageContent}
            width={800}
          />
        </Document>
      </div>
    </div>
  );
};

export default NativePdfViewer;
