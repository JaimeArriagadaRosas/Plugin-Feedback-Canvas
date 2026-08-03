import { lazy } from 'react';

// Registry de estrategias que carga los componentes de forma diferida (Code Splitting)
export const CONTENT_REGISTRY = {
  unsubmitted: lazy(() => import('./strategies/UnsubmittedViewer')),
  unsupported_file: lazy(() => import('./strategies/UnsupportedFileViewer')),
  fallback_empty: lazy(() => import('./strategies/FallbackEmptyViewer')),
  iframe_preview: lazy(() => import('./strategies/IframePreviewViewer')),
  native_pdf: lazy(() => import('../../views/speedgrader/NativePdfViewer')),
  online_quiz: lazy(() => import('../../views/speedgrader/QuizViewer')),
  text_entry: lazy(() => import('../../views/speedgrader/TextEntryViewer'))
};

export const getContentTypeRenderer = (type) => {
  return CONTENT_REGISTRY[type] || CONTENT_REGISTRY['fallback_empty'];
};
