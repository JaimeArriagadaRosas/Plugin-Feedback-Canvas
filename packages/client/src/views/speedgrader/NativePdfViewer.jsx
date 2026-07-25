import React, { useState } from 'react';
import { pdfjs, Document, Page } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import styles from './NativePdfViewer.module.css';

// Configurar el worker para react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PdfSkeleton = () => (
  <div className={styles.skeletonContainer}>
    <span className={styles.loadingText}>Procesando documento...</span>
  </div>
);

const NativePdfViewer = ({ fileUrl }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    console.log(`[NativePdfViewer] Iniciando carga de documento proxyUrl: ${fileUrl}`);
    console.time('PDF_Load_Time');
    return () => {
      // Si el componente se desmonta antes de cargar, limpiaremos el timer (aunque puede dar un warning en consola, es preferible)
    };
  }, [fileUrl]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    console.timeEnd('PDF_Load_Time');
    setNumPages(numPages);
    setError(null);
  };

  const onDocumentLoadError = (err) => {
    console.error('[NativePdfViewer] Error loading PDF:', err);
    try { console.timeEnd('PDF_Load_Time'); } catch (e) {} // Evitar error si no había timer activo
    setError('No se pudo cargar el documento.');
  };

  const changePage = (offset) => {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  };

  const previousPage = () => changePage(-1);
  const nextPage = () => changePage(1);

  if (error) {
    return <div className={styles.errorContainer}>{error}</div>;
  }

  return (
    <div className={styles.pdfContainer}>
      <div className={styles.controls}>
        <button 
          disabled={pageNumber <= 1} 
          onClick={previousPage}
          className={styles.controlButton}
        >
          Anterior
        </button>
        <span className={styles.pageInfo}>
          Página {pageNumber || (numPages ? 1 : '--')} de {numPages || '--'}
        </span>
        <button
          disabled={pageNumber >= numPages}
          onClick={nextPage}
          className={styles.controlButton}
        >
          Siguiente
        </button>
      </div>
      <div className={styles.documentWrapper}>
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<PdfSkeleton />}
        >
          <Page 
            pageNumber={pageNumber} 
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
