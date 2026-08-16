import logger from '../utils/logger.js';

/**
 * Logs and manages production database errors.
 * No longer automatically downgrades to local on error to prevent
 * inconsistent states and split-brain.
 */
export function handleDbError(err, context = '') {
  const errorMessage = err?.message || err?.toString() || 'Unknown DB error';
  
  if (process.env.NODE_ENV === 'production') {
    logger.error(`[DB] Production operation failed (${context}): ${errorMessage}`, { stack: err?.stack });
  } else {
    logger.warn(`[DB] Operation failed (${context}): ${errorMessage}`, { stack: err?.stack });
  }
}
