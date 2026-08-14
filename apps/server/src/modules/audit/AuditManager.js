import db from '../../data/db.js';
import { ApiError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

export const AUDIT_EVENT_TYPES = {
  ACCESS_DENIED: 'ACCESS_DENIED',
  AI_CONFIGURATION_ALTERED: 'AI_CONFIGURATION_ALTERED',
  LTI_VALIDATION_FAILED: 'LTI_VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  CRITICAL_SYSTEM_ERROR: 'CRITICAL_SYSTEM_ERROR',
  OTHER: 'OTHER',
};

class AuditManager {
  /**
   * Registra un evento de seguridad en la Base de Datos con estandarización.
   *
   * @param {string} tipo - Tipo de evento (usar AUDIT_EVENT_TYPES).
   * @param {string} usuarioId - ID del usuario responsable, si existe.
   * @param {string} ip - IP de la solicitud.
   * @param {string|object} detalle - Información extra sobre el evento.
   */
  async logSecurityEvent(tipo, usuarioId, ip, detalle) {
    if (!Object.values(AUDIT_EVENT_TYPES).includes(tipo)) {
      logger.warn('AuditManager', `Unrecognized audit event type: ${tipo}`);
      tipo = AUDIT_EVENT_TYPES.OTHER;
    }

    const detalleStr = typeof detalle === 'object' ? JSON.stringify(detalle) : detalle;

    try {
      const query = `
        INSERT INTO Logs_Auditoria (usuario_id, accion, detalle, ip_address, fecha)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *;
      `;
      const values = [usuarioId || 'SYSTEM', tipo, detalleStr, ip || 'UNKNOWN'];
      
      const result = await db.query(query, values);
      logger.info('AuditManager', `Audit event registered: ${tipo}`, { logId: result.rows[0].id });
      
      return result.rows[0];
    } catch (error) {
      logger.error('AuditManager', 'Error inserting audit log', { error });
      // We don't throw an error so it doesn't block the original request, as this is just logging
    }
  }

  /**
   * Obtiene los logs de auditoría paginados.
   */
  async getPaginatedLogs(page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    try {
      const countRes = await db.query('SELECT COUNT(*) FROM Logs_Auditoria');
      const total = parseInt(countRes.rows[0].count, 10);

      const logsRes = await db.query(
        'SELECT * FROM Logs_Auditoria ORDER BY fecha DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );

      return {
        logs: logsRes.rows,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new ApiError('Error retrieving audit logs from database', 500);
    }
  }

  /**
   * Obtiene únicamente los logs críticos o fallidos (para producción y exportación).
   * @param {number} limit - Límite de logs a recuperar (por defecto 200).
   */
  async getCriticalLogs(limit = 200) {
    try {
      const logsRes = await db.query(`
        SELECT * FROM Logs_Auditoria 
        WHERE accion LIKE '%DENIED%' 
           OR accion LIKE '%FAILED%' 
           OR accion LIKE '%ERROR%' 
           OR accion LIKE '%ALTERED%' 
           OR accion LIKE '%EXCEEDED%'
           OR accion LIKE '%DENIED%'
        ORDER BY fecha DESC 
        LIMIT $1
      `, [limit]);

      return {
        logs: logsRes.rows,
        pagination: {
          total: logsRes.rows.length,
          page: 1,
          limit,
          pages: 1
        }
      };
    } catch (error) {
      throw new ApiError('Error retrieving critical audit logs', 500);
    }
  }
}

export default new AuditManager();
