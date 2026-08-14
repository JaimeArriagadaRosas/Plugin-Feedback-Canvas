import db from '../data/db.js';
import { redactBody } from '../security/audit.js';

/**
 * Audit Middleware — Logs actions that modify data (POST/PUT/DELETE).
 *
 * FIX: Fixed async monkey-patching pattern that caused potential recursion.
 *      Now using res.on('finish') instead of overwriting res.send,
 *      which is the recommended Express pattern for response hooks.
 */
export const auditLogMiddleware = (req, res, next) => {
  const method = req.method;

  if (!['POST', 'PUT', 'DELETE'].includes(method)) {
    return next();
  }

  const originalJson = res.json;
  const originalSend = res.send;

  const logAuditAndSend = (originalMethod, body) => {
    // Restore immediately to avoid recursion
    res.json = originalJson;
    res.send = originalSend;

    const url = req.originalUrl;
    const statusCode = res.statusCode;
    const usuarioId = req.appIdentity?.canonicalUserId || (req.headers['authorization'] ? 'LTI_USER' : 'ANON');
    const accion = `${method} ${url}`;
    const detalle = `Status: ${statusCode} | Body: ${redactBody(req.body || {}, 300)}`;
    const ipAddress = req.ip || req.socket?.remoteAddress || null;

    db.query(
      `INSERT INTO Logs_Auditoria (usuario_id, accion, detalle, ip_address) VALUES ($1, $2, $3, $4)`,
      [usuarioId, accion, detalle, ipAddress]
    )
    .catch(dbErr => {
      console.warn(`[AUDIT-FALLBACK] Critical error saving to DB: ${dbErr.message}`);
    })
    .finally(() => {
      originalMethod.call(res, body);
    });
  };

  res.json = function(obj) { logAuditAndSend(originalJson, obj); };
  res.send = function(body) { logAuditAndSend(originalSend, body); };

  next();
};
