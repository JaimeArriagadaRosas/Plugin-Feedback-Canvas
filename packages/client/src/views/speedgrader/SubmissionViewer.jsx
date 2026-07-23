import styles from './SubmissionViewer.module.css';

export default function SubmissionViewer({
  submission,
  studentName,
  assignmentName,
  className = '',
}) {
  let isZipOrRar = false;
  let hasPreviewUrl = false;
  let previewUrl = '';
  let textBody = '';
  let fileName = '';
  let fileUrl = '';
  let submittedAt = 'Sin fecha';

  if (submission) {
    if (submission.submitted_at) {
      submittedAt = new Date(submission.submitted_at).toLocaleString();
    }
    
    // Revisar si hay adjuntos (attachments)
    if (submission.attachments && submission.attachments.length > 0) {
      const attachment = submission.attachments[0];
      fileName = attachment.filename || attachment.display_name || '';
      fileUrl = attachment.url || '';
      
      const ext = fileName.split('.').pop().toLowerCase();
      if (['zip', 'rar', '7z'].includes(ext)) {
        isZipOrRar = true;
      }
    }
    
    // Revisar si hay un enlace de previsualización (Canvadocs)
    if (submission.preview_url) {
      hasPreviewUrl = true;
      previewUrl = submission.preview_url;
    }
    
    // Fallback de texto si hay body HTML
    if (submission.body) {
      textBody = submission.body.replace(/<[^>]+>/g, '');
    } else if (!isZipOrRar && !hasPreviewUrl) {
      textBody = "Sin contenido de entrega.";
    }
  } else {
    textBody = "Sin entrega.";
  }

  const renderContent = () => {
    if (!submission) {
      return (
        <div className={styles.paper}>
          <hr className={styles.divider} />
          <p className={styles.text}>{textBody}</p>
        </div>
      );
    }

    if (isZipOrRar) {
      return (
        <div className={styles.zipBox}>
          <div className={styles.zipIcon}>📦</div>
          <div className={styles.zipName}>{fileName}</div>
          <div className={styles.zipDesc}>Archivo comprimido sin vista previa.</div>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className={styles.downloadBtn}>
              Descargar Archivo
            </a>
          )}
        </div>
      );
    }

    if (hasPreviewUrl) {
      return (
        <iframe
          src={previewUrl}
          className={styles.iframeViewer}
          title={`Entrega de ${studentName}`}
        />
      );
    }

    return (
      <div className={styles.paper}>
        <hr className={styles.divider} />
        <p className={styles.text}>{textBody}</p>
      </div>
    );
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
