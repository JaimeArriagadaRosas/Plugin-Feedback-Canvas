import db from '../datos/db.js';
import logger from '../utils/logger.js';

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

  // Capturar el fin de la respuesta de forma segura (sin monkey-patch)
  res.on('finish', async () => {
    try {
      const url = req.originalUrl;
      const statusCode = res.statusCode;
      const usuarioId = req.ltiContext?.user || (req.headers['authorization'] ? 'LTI_USER' : 'ANON');
      const accion = `${method} ${url}`;
      const detalle = `Status: ${statusCode} | Body: ${JSON.stringify(req.body || {}).substring(0, 300)}`;

      if (db.isMock()) {
        logger.debug(`[AUDIT-LOCAL] ${accion} por ${usuarioId}`, {
          status: statusCode,
          detalle: detalle.substring(0, 100)
        });
      } else {
        await db.query(
          `INSERT INTO logs_auditoria (usuario_id, accion, detalle) VALUES ($1, $2, $3)`,
          [usuarioId, accion, detalle]
        );
        logger.debug(`[AUDIT-DB] ${accion} por ${usuarioId} registrado en PostgreSQL`);
      }
    } catch (err) {
      // El error de auditoría no debe afectar la respuesta (ya fue enviada)
      logger.warn('Error guardando entrada de auditoría (no crítico):', { error: err.message });
    }
  });

  next();
};
