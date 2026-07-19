import logger from '../utils/logger.js';

/**
 * Registra y gestiona los errores de la base de datos de producción.
 * Ya no degrada a local automáticamente en caso de error para evitar
 * estados inconsistentes y particiones de cerebro (split-brain).
 */
export function handleDbError(err, context = '') {
  const errorMessage = err?.message || err?.toString() || 'Error desconocido en DB';
  
  if (process.env.NODE_ENV === 'production') {
    logger.error(`[DB] Fallo en operación de producción (${context}): ${errorMessage}`, { stack: err?.stack });
  } else {
    logger.warn(`[DB] Fallo en operación (${context}): ${errorMessage}`, { stack: err?.stack });
  }
}
