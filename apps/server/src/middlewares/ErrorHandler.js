import { AppError } from '../utils/errors.js';
import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';

/**
 * Middleware de manejo de errores centralizado (RF40)
 *
 * DESIGN-08 FIX: Distingue errores operacionales (AppError, isOperational=true)
 * de errores de programación (TypeError, ReferenceError, etc.).
 * - Errores operacionales: se devuelve su mensaje al cliente.
 * - Errores de programación: se devuelve un mensaje genérico y se alerta en logs.
 */


export const ErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = err.isOperational === true || err.name === 'ApiError' || err.name === 'AppError';
  const isDev = process.env.NODE_ENV === 'development';

  if (isOperational) {
    logger.warn(`[ERROR-OP] ${statusCode} ${err.message}`, { path: req.originalUrl });
  } else {
    // Error de programación — loguear con stack completo para debugging
    logger.error(`[ERROR-PROG] ${nowIso()}:`, { error: err.stack || err.message, path: req.originalUrl });
  }

  // RF54: Registrar en BD accesos no autorizados (401, 403)
  if (statusCode === 401 || statusCode === 403) {
    import('../data/db.js').then(({ default: db }) => {
      const ipAddress = req.ip || req.socket?.remoteAddress || null;
      const usuarioId = req.ltiContext?.user || req.user?.id || 'ANON';
      const accion = `DENIED ${req.method} ${req.originalUrl}`;
      const detalle = `Status: ${statusCode} | Mensaje: ${err.message}`;
      db.query(
        `INSERT INTO Logs_Auditoria (usuario_id, accion, detalle, ip_address) VALUES ($1, $2, $3, $4)`,
        [usuarioId, accion, detalle, ipAddress]
      ).catch(dbErr => logger.error(`[ERROR-PROG] Falla loggeando auditoría DB: ${dbErr.message}`));
    }).catch(importErr => logger.error(`[ERROR-PROG] Falla importando DB: ${importErr.message}`));
  }

  // En producción, los errores no operacionales devuelven un mensaje genérico
  // para no filtrar detalles de implementación.
  const clientMessage = isDev
    ? (err.message || 'Internal Server Error')
    : (isOperational ? err.message : (statusCode === 404 ? 'No encontrado' : 'Error interno del servidor'));

  res.status(statusCode).json({
    exito: false,
    error: {
      mensaje: clientMessage,
      codigo: statusCode,
      timestamp: nowIso(),
      path: req.originalUrl,
      ...(isDev && { stack: err.stack, detalle: err.message })
    }
  });
};
