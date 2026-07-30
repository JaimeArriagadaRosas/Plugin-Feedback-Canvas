import db from '../../data/db.js';
import { ApiError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

export const AUDIT_EVENT_TYPES = {
  ACCESO_DENEGADO: 'ACCESO_DENEGADO',
  CONFIGURACION_IA_ALTERADA: 'CONFIGURACION_IA_ALTERADA',
  VALIDACION_LTI_FALLIDA: 'VALIDACION_LTI_FALLIDA',
  LIMITE_RATE_EXCEDIDO: 'LIMITE_RATE_EXCEDIDO',
  ERROR_SISTEMA_CRITICO: 'ERROR_SISTEMA_CRITICO',
  OTRO: 'OTRO',
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
      logger.warn('AuditManager', `Tipo de evento de auditoría no reconocido: ${tipo}`);
      tipo = AUDIT_EVENT_TYPES.OTRO;
    }

    const detalleStr = typeof detalle === 'object' ? JSON.stringify(detalle) : detalle;

    try {
      const query = `
        INSERT INTO Logs_Auditoria (usuario_id, accion, detalle, ip_address, fecha)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *;
      `;
      const values = [usuarioId || 'SISTEMA', tipo, detalleStr, ip || 'UNKNOWN'];
      
      const result = await db.query(query, values);
      logger.info('AuditManager', `Evento de auditoría registrado: ${tipo}`, { logId: result.rows[0].id });
      
      return result.rows[0];
    } catch (error) {
      logger.error('AuditManager', 'Error al insertar log de auditoría', { error });
      // No lanzamos error para que no bloquee la petición original, ya que esto es solo logging
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
      throw new ApiError('Error al recuperar los logs de auditoría de la base de datos', 500);
    }
  }
}

export default new AuditManager();
