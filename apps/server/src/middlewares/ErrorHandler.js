import { nowIso } from '../utils/datetime.js';
import logger from '../utils/logger.js';

/**
 * Centralized error handling middleware (RF40)
 *
 * DESIGN-08 FIX: Distinguishes operational errors (AppError, isOperational=true)
 * from programming errors (TypeError, ReferenceError, etc.).
 * - Operational errors: their message is returned to the client.
 * - Programming errors: a generic message is returned and logged.
 */


export const ErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const isOperational = err.isOperational === true || err.name === 'ApiError' || err.name === 'AppError';
  const isDev = process.env.NODE_ENV === 'development';

  if (isOperational) {
    logger.warn(`[ERROR-OP] ${statusCode} ${err.message}`, { path: req.originalUrl });
  } else {
    // Programming error — log with full stack for debugging
    logger.error(`[ERROR-PROG] ${nowIso()}:`, { error: err.stack || err.message, path: req.originalUrl });
  }

  // RF54: Log unauthorized access in DB (401, 403)
  if (statusCode === 401 || statusCode === 403) {
    import('../data/db.js').then(({ default: db }) => {
      const ipAddress = req.ip || req.socket?.remoteAddress || null;
      const usuarioId = req.appIdentity?.canonicalUserId || req.user?.id || 'ANON';
      const accion = `DENIED ${req.method} ${req.originalUrl}`;
      const detalle = `Status: ${statusCode} | Mensaje: ${err.message}`;
      db.query(
        `INSERT INTO Logs_Auditoria (usuario_id, accion, detalle, ip_address) VALUES ($1, $2, $3, $4)`,
        [usuarioId, accion, detalle, ipAddress]
      ).catch(dbErr => logger.error(`[ERROR-PROG] Failed logging DB audit: ${dbErr.message}`));
    }).catch(importErr => logger.error(`[ERROR-PROG] Failed importing DB: ${importErr.message}`));
  }

  // In production, non-operational errors return a generic message
  // to not leak implementation details.
  const clientMessage = isDev
    ? (err.message || 'Internal Server Error')
    : (isOperational ? err.message : (statusCode === 404 ? 'Not found' : 'Internal server error'));

  res.status(statusCode).json({
    exito: false,
    error: {
      mensaje: clientMessage,
      codigo: statusCode,
      codigoError: err.errorCode || (isOperational ? 'OPERATIONAL_ERROR' : 'UNKNOWN_ERROR'),
      timestamp: nowIso(),
      path: req.originalUrl,
      ...(isDev && { stack: err.stack, detalle: err.message })
    }
  });
};
