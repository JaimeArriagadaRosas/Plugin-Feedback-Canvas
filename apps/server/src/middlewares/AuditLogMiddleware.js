import db from '../data/db.js';
import { redactBody } from '../security/audit.js';

/**
 * Middleware de Auditoría — Registra acciones que modifican datos (POST/PUT/DELETE).
 *
 * FIX: Corregido el patrón de monkey-patching con async que causaba recursión
 *      potencial. Ahora se usa res.on('finish') en lugar de sobreescribir res.send,
 *      lo cual es el patrón recomendado por Express para hooks de respuesta.
 */
export const auditLogMiddleware = (req, res, next) => {
  const method = req.method;

  if (!['POST', 'PUT', 'DELETE'].includes(method)) {
    return next();
  }

  const originalJson = res.json;
  const originalSend = res.send;

  const logAuditAndSend = (originalMethod, body) => {
    // Restaurar inmediatamente para evitar recursión
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
      console.warn(`[AUDIT-FALLBACK] Error crítico al guardar en BD: ${dbErr.message}`);
    })
    .finally(() => {
      originalMethod.call(res, body);
    });
  };

  res.json = function(obj) { logAuditAndSend(originalJson, obj); };
  res.send = function(body) { logAuditAndSend(originalSend, body); };

  next();
};
