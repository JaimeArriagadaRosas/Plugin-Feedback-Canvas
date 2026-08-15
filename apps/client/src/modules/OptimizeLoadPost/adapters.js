import { isSupportedForPreview } from '../../utils/fileViewer';

/**
 * Determines the content type based on raw submission data
 * @param {Object} submission 
 * @returns {string} content type
 */
export function resolveContentType(submission) {
  if (!submission) return 'fallback_empty';
  if (submission.workflow_state === 'unsubmitted' || submission.missing) return 'unsubmitted';

  if (submission.attachments && submission.attachments.length > 0) {
    const attachment = submission.attachments[0];
    const fileName = attachment.filename || attachment.display_name || 'document';
    if (!isSupportedForPreview(fileName)) {
      return 'unsupported_file';
    }
    return 'native_pdf';
  }

  if (submission.submission_type === 'online_quiz') return 'online_quiz';
  if (submission.body) return 'text_entry';
  if (submission.preview_url) return 'iframe_preview';

  return 'fallback_empty';
}

/**
 * Base adapter to extract standard properties
 */
export function baseAdapter(payload, type) {
  const { submission, studentName, assignmentName } = payload;
  
  let submittedAt = 'No date';
  if (submission && submission.submitted_at) {
    submittedAt = new Date(submission.submitted_at).toLocaleString();
  }
  
  const attempt = submission ? submission.attempt || 1 : 'N/A';

  return {
    type,
    submittedAt,
    attempt,
    studentName: studentName || 'Student',
    assignmentName
  };
}

/**
 * Specific adapters by type to deliver clean props to each Strategy
 */
export const adapters = {
  unsubmitted: (payload, type) => {
    return {
      ...baseAdapter(payload, type)
    };
  },
  
  unsupported_file: (payload, type) => {
    const { submission } = payload;
    const attachment = submission.attachments[0];
    const fileName = attachment.filename || attachment.display_name || 'document';
    const fileUrl = attachment.url || '';
    
    return {
      ...baseAdapter(payload, type),
      fileName,
      fileUrl
    };
  },
  
  native_pdf: (payload, type) => {
    const { submission } = payload;
    const attachment = submission.attachments[0];
    const fileUrl = attachment.url || '';
    const proxyUrl = `/api/courses/file/preview?url=${encodeURIComponent(fileUrl)}`;
    
    return {
      ...baseAdapter(payload, type),
      fileUrl: proxyUrl
    };
  },
  
  online_quiz: (payload, type) => {
    const { quizDetails } = payload;
    return {
      ...baseAdapter(payload, type),
      quizDetails
    };
  },
  
  text_entry: (payload, type) => {
    const { submission } = payload;
    return {
      ...baseAdapter(payload, type),
      submission
    };
  },
  
  iframe_preview: (payload, type) => {
    const { submission } = payload;
    return {
      ...baseAdapter(payload, type),
      previewUrl: submission.preview_url
    };
  },
  
  fallback_empty: (payload, type) => {
    const { submission } = payload;
    let textBody = "No submission.";
    if (submission) {
      textBody = "No submission content.";
    }
    return {
      ...baseAdapter(payload, type),
      textBody
    };
  },
  
  readonly_mode: (payload, type) => {
    return {
      ...baseAdapter(payload, type)
    };
  }
};
