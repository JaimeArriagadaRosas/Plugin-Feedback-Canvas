import logger from '../utils/logger.js';

/**
 * Política de degradación de la capa de datos.
 *
 * CORRECCIÓN: db.js degradaba SILENCIOSAMENTE a una "BD" en memoria ante
 * cualquier error de PostgreSQL, perdiendo escrituras sin fallar. Para datos
 * académicos eso es inaceptable. Ahora en producción se falla explícitamente
 * (fail-loud): el error se propaga y la petición devuelve 5xx en vez de
 * servir datos vacíos/incorrectos.
 */
export function shouldDegradeToLocal() {
  if (process.env.NODE_ENV === 'production') return false;
  return true;
}

/**
 * Decide si se puede degradar a modo local tras un error de BD.
 * En producción lanza el error (no lo oculta).
 */
export function handleDbError(err, context = '') {
  if (process.env.NODE_ENV === 'production') {
    console.error('[DB] Error en producción; fallando explícitamente (sin degradar a local).', {
      error: err.message,
      context,
    });
    throw err;
  }
  console.warn(`[DB] Error (modo dev): ${err.message}. Degradando a local.`, { context });
  return true;
}
